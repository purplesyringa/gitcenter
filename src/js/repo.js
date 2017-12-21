INITIAL_FOLLOW_QUERIES = {
	"{object}s": "\
		SELECT\
			'{object}' AS type,\
			{object}s.date_added AS date_added,\
			{object}s.title AS title,\
			{object}s.body AS body,\
			'repo/{url_object}s/view/?' || json.site || '/' || {object}s.id || '@' || REPLACE(json.directory, 'data/users/', '') AS url\
		FROM {object}s, json\
		WHERE {object}s.json_id = json.json_id AND json.site IN (:params)\
	",
	"{object}Comments": "\
		SELECT\
			'comment' AS type,\
			{object}_comments.date_added AS date_added,\
			{object}s_json.title AS title,\
			'@' || REPLACE(cert_user_id, '@zeroid.bit', '') || ': ' || {object}_comments.body AS body,\
			'repo/{url_object}s/view/?' || {object}s_json.site || '/' || {object}s_json.id || '@' || REPLACE({object}s_json.directory, 'data/users/', '') AS url\
		FROM\
			{object}_comments\
		LEFT JOIN\
			(\
				SELECT id, title, body, json_id, site, directory\
				FROM {object}s\
				LEFT JOIN json USING (json_id)\
			) AS {object}s_json\
		ON\
			(\
				{object}_comments.{object}_id = {object}s_json.id AND\
				{object}_comments.{object}_json = {object}s_json.directory\
			)\
		LEFT JOIN\
			(SELECT cert_user_id, json_id AS comment_json_id FROM json) AS comment_json\
		ON\
			(comment_json.comment_json_id = {object}_comments.json_id)\
		WHERE\
			{object}s_json.site IN (:params) AND\
			{object}_comments.json_id IN (SELECT json_id FROM json WHERE json.site = {object}s_json.site)\
	",
	"{object}Actions": "\
		SELECT\
			'comment' AS type,\
			{object}_actions.date_added AS date_added,\
			{object}s_json.title AS title,\
			{object}_actions.param AS param,\
			'repo/{url_object}s/view/?' || {object}s_json.site || '/' || {object}s_json.id || '@' || REPLACE({object}s_json.directory, 'data/users/', '') AS url,\
			'@' || REPLACE(cert_user_id, '@zeroid.bit', '') || ': ' || (\
				CASE\
					WHEN {object}_actions.action = 'changeStatus'\
						THEN (CASE WHEN {object}_actions.param = 'reopen' THEN 'Reopened {text_object}' ELSE 'Closed {text_object}' END)\
					WHEN {object}_actions.action = 'changeTags'\
						THEN 'Changed tags: ' || {object}_actions.param\
					WHEN {object}_actions.action = 'addTags'\
						THEN 'Added tags ' || REPLACE({object}_actions.param, ',', ', ')\
					WHEN {object}_actions.action = 'removeTags'\
						THEN 'Removed tags ' || REPLACE({object}_actions.param, ',', ', ')\
					ELSE 'Action ' || {object}_actions.action\
				END\
			) AS body\
		FROM\
			{object}_actions\
		LEFT JOIN\
			(\
				SELECT id, title, body, json_id, site, directory\
				FROM {object}s\
				LEFT JOIN json USING (json_id)\
			) AS {object}s_json\
		ON\
			(\
				{object}_actions.{object}_id = {object}s_json.id AND\
				{object}_actions.{object}_json = {object}s_json.directory\
			)\
		LEFT JOIN\
			(SELECT cert_user_id, json_id AS action_json_id FROM json) AS action_json\
		ON\
			(action_json.action_json_id = {object}_actions.json_id)\
		WHERE\
			{object}s_json.site IN (:params) AND\
			{object}_actions.json_id IN (SELECT json_id FROM json WHERE json.site = {object}s_json.site)\
	"
};

FOLLOW_QUERIES = adjustFollowQueries(INITIAL_FOLLOW_QUERIES, [
	{object: "issue", url_object: "issue", text_object: "issue", follow: "issue"},
	{object: "pull_request", url_object: "pull-request", text_object: "pull request", follow: "pullRequest"}
]);
FOLLOW_QUERIES.actions = FOLLOW_QUERIES.issueActions + "\nUNION\n" + FOLLOW_QUERIES.pullRequestActions;

function adjustFollowQueries(queries, objects) {
	return objects
		.map(object => {
			return Object.keys(queries)
				.map(key => {
					let value = queries[key]
						.replace(/{object}/g, object.object)
						.replace(/{url_object}/g, object.url_object)
						.replace(/{text_object}/g, object.text_object);

					key = key.replace(/{object}/g, object.follow);

					return {[key]: value};
				});
		})
		.reduce((arr, val) => arr.concat(val), []) // flatten
		.reduce((obj, val) => Object.assign(obj, val), {}); // to object
}

class Repository {
	constructor(address, zeroPage) {
		this.address = address;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
		this.zeroAuth = new ZeroAuth(zeroPage);
		this.zeroDB = new ZeroDB(zeroPage);
		this.issues = new RepositoryIssues(this);
	}

	// Checks whether file `path` of repository can be signed by current user.
	// If undefined, path is assumed to be content.json
	isSignable(path) {
		if(!path) {
			path = "content.json";
		}

		return this.zeroPage.isSignable("merged-GitCenter/" + this.address + "/" + path)
			.then(signable => {
				if(!signable) {
					return this.zeroPage.cmd("mergerSiteList", [true])
						.then(list => {
							if(!list[this.address]) {
								return Promise.reject("Merged site not found");
							}

							return list[this.address].privatekey;
						});
				}

				return true;
			});
	}

	// Returns cache for current repository from localStorage
	getLocalCache() {
		return this.zeroPage.cmd("wrapperGetLocalStorage")
			.then(storage => {
				if(!storage || !storage.repoCache || !storage.repoCache[this.address]) {
					return {};
				}

				return storage.repoCache[this.address];
			})
	}
	// Saves cache for current repository
	setLocalCache(cache) {
		return this.zeroPage.cmd("wrapperGetLocalStorage")
			.then(storage => {
				if(!storage) {
					storage = {
						repoCache: {}
					};
				} else if(!storage.repoCache) {
					storage.repoCache = {};
				}

				storage.repoCache[this.address] = cache;

				return this.zeroPage.cmd("wrapperSetLocalStorage", storage);
			});
	}

	/***************************** Permission actions *****************************/

	// Tries to add current site as merged site. Also adds index as merged, ZeroID
	// as CORS. If current repository is a fork, also tries to set it up.
	addMerger() {
		let siteInfo, list, content, repoBase;
		return this.zeroPage.getSiteInfo()
			.then(s => {
				siteInfo = s;

				if(siteInfo.settings.permissions.indexOf("Merger:GitCenter") == -1) {
					return zeroPage.cmd("wrapperPermissionAdd", ["Merger:GitCenter"]);
				}
			})
			.then(() => {
				if(siteInfo.settings.permissions.indexOf("Cors:1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz") == -1) {
					return zeroPage.cmd("corsPermission", ["1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz"]);
				}
			})
			.then(() => {
				return this.addMergedSite(this.address);
			})
			.then(() => {
				return this.addMergedSite("1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL");
			})
			.then(() => {
				return this.getContent();
			})
			.then(c => {
				content = c;
				if(content.git) {
					this.git = new Git("merged-GitCenter/" + this.address + "/" + content.git, zeroPage);
					return this.git.init();
				} else {
					this.git = null;
				}
			})
			.then(() => {
				return this.updateFollow();
			})
			.then(() => {
				repoBase = new Repository(content.cloned_from, this.zeroPage);
				return repoBase.getLocalCache();
			})
			.then(cache => {
				cache = cache || {};
				if(cache.justForked) {
					delete cache.justForked;

					let progress = this.zeroPage.progress("Setting up fork...");

					return this.installFork()
						.then(() => {
							progress.done();
							return repoBase.setLocalCache(cache);
						}, e => {
							progress.setMessage((e && e.error) || e);
							progress.setPercent(-1);
						});
				}
			});
	}

	// Add site `address` as merged site and wait for any file to download.
	addMergedSite(address) {
		return this.zeroPage.cmd("mergerSiteList")
			.then(list => {
				if(list[address]) {
					return;
				}

				return new Promise((resolve, reject) => {
					// Wait for some file to download
					let handler = siteInfo => {
						if(siteInfo.params.address != address) {
							return;
						}

						let event = siteInfo.params.event;
						if(event[0] == "file_done") {
							this.zeroPage.off("setSiteInfo", handler);
							resolve(true);
						}
					};
					this.zeroPage.on("setSiteInfo", handler);

					this.zeroPage.cmd("mergerSiteAdd", [address]);
				});
			});
	}

	/******************************* Content actions ******************************/

	// Sign and publish `path` of current repository using `signStyle`.
	// `signStyle` is `site` for using site private key or anything else for using
	// ZeroID.
	signAndPublish(path, signStyle) {
		return this.zeroPage.cmd("siteSign", {inner_path: path, privatekey: signStyle == "site" ? "stored" : null})
			.then(() => {
				return this.zeroPage.cmd("sitePublish", {inner_path: path, sign: false})
			})
			.then(res => {
				if(res != "ok" && res.error != "Port not opened." && res.error != "Content publish failed.") {
					return Promise.reject(res);
				}
			});
	}

	// Returns parsed content.json
	getContent() {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/content.json", true)
			.then(content => JSON.parse(content));
	}

	// Saves content.json
	setContent(content) {
		return this.zeroFS.writeFile("merged-GitCenter/" + this.address + "/content.json", JSON.stringify(content, null, "\t"));
	}

	// Signs and publishes content.json
	// `signStyle` is described in `signAndPublish`
	signContent(signStyle) {
		return this.signAndPublish("merged-GitCenter/" + this.address + "/content.json", signStyle);
	}

	// Signs content.json
	sign() {
		return this.zeroPage.cmd("siteSign", {inner_path: "merged-GitCenter/" + this.address + "/content.json"})
			.then(res => {
				if(res != "ok") {
					return Promise.reject(res);
				}
			});
	}

	// Returns array of valid signers for current repository
	getSigners() {
		return this.getContent()
			.then(content => {
				let signers = (
					typeof content.signers == "object" &&
					content.signers !== null &&
					content.signers instanceof Array
				) ? content.signers : [];

				if(signers.indexOf(this.address) == -1) {
					signers.push(this.address);
				}

				return signers;
			});
	}

	// Returns true if current ZeroID is a valid signer
	isOwned() {
		let signers;
		return this.getSigners()
			.then(s => {
				signers = s;

				return this.zeroPage.getUser();
			})
			.then(address => {
				return signers.indexOf(address) > -1;
			});
	}

	// Returns repository owner auth_address
	getOwnerAddress() {
		return this.getLocalCache()
			.then(cache => {
				if(cache.owner) {
					return cache.owner;
				}

				return this.getSigners()
					.then(signers => {
						if(signers.length == 1 && signers[0] != this.address) {
							// One signer, easy to detect
							return signers[0];
						} else if(signers.length == 2 && signers.indexOf(this.address) > -1) {
							// Two signers, one is repository itself
							return signers[0] == this.address ? signers[1] : signers[0];
						}

						return Promise.reject("Failed to get owner");
					})
					.then(address => {
						cache.owner = address;
						return this.setLocalCache(cache);
					})
					.then(() => {
						return cache.owner;
					});
			});
	}

	// Returns name of repository owner
	getOwner() {
		let address;

		return this.getOwnerAddress()
			.then(a => {
				address = a;
				return this.zeroFS.readFile("data/users/" + address + "/data.json");
			})
			.then(profile => {
				profile = JSON.parse(profile);
				return profile.commitName;
			}, e => {
				if(!address) {
					return Promise.reject(e);
				}

				return this.findUserById(address)
					.then(user => {
						return user.name;
					});
			})
			.catch(() => {
				return "Anonymous";
			});
	}

	// Changes title of repository (deprecated)
	rename(newName) {
		return this.getContent()
			.then(content => {
				content.title = newName;
				return this.setContent(content);
			})
			.then(() => this.sign());
	}

	// Changes description of repository
	changeDescription(description) {
		return this.getContent()
			.then(content => {
				content.description = description;
				return this.setContent(content);
			})
			.then(() => this.sign());
	}

	// Adds or removes hooks from repository
	changeHooks(hooks) {
		return this.getContent()
			.then(content => {
				content.hooks = hooks;
				return this.setContent(content);
			})
			.then(() => this.sign());
	}

	// Sets up new repository (not fork). Sets title, description, signers.
	install(title, description, address) {
		let auth, content;
		return this.getContent()
			.then(c => {
				content = c;

				return this.zeroAuth.requestAuth();
			})
			.then(a => {
				auth = a;

				content.title = title;
				content.description = description;
				content.signers = [auth.address];
				content.installed = true;
				content.git = address;
				content.hooks = false;
				return this.setContent(content);
			})
			.then(() => {
				return this.zeroFS.readFile("data/users/" + auth.address + "/data.json")
					.catch(() => "{}");
			})
			.then(profile => {
				profile = JSON.parse(profile);

				profile.commitName = profile.commitName || auth.user[0].toUpperCase() + auth.user.substr(1).replace(/@.*/, "");
				profile.commitEmail = profile.commitEmail || auth.user;

				return Git.init("merged-GitCenter/" + this.address + "/" + address + (address.endsWith(".git") ? "" : ".git"), this.zeroPage, profile.commitName, profile.commitEmail);
			})
			.then(git => {
				this.git = git;
				return this.signContent("site");
			});
	}

	/************************************ Fork ************************************/

	// Clones a repository
	fork() {
		// `siteClone` doesn't give us any clue about what is resulting repository
		// address. So we assume that one doesn't fork a repository during the same
		// repository is forked. We set `justForked` to local cache of this repository.
		// Later we will check if `justForked` is set for `cloned_from` site of
		// content.json. Notice that `cloned_from` can be 1Repo..., though that doesn't
		// have cache at all usually.
		return this.getLocalCache()
			.then(cache => {
				cache = cache || {};
				cache.justForked = true;
				return this.setLocalCache(cache);
			})
			.then(() => {
				return this.zeroPage.cmd("siteClone", [this.address]);
			});
	}

	// Sets `signers` property of fork and removes `my` from title. This is done
	// here and not in fork() because `siteClone` doesn't give us control over fork.
	installFork() {
		let auth;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;
				return this.getContent();
			})
			.then(content => {
				content.title = content.title.replace(/^my/, "");
				content.signers = [auth.address];
				return this.setContent(content);
			})
			.then(() => {
				return this.signContent("site");
			});
	}

	/********************************* Git actions ********************************/

	// Returns list of files in directory
	getFiles(branch, dir) {
		return this.git.readBranchCommit(branch)
			.then(commit => {
				return this.getTree(commit.content.tree, dir);
			});
	}

	// Returns list of files in directory and submodules
	getTree(tree, dir) {
		let submodules;

		return this.git.getSubmodules(tree)
			.then(s => {
				submodules = s;

				return this.git.readTreeItem(tree, dir);
			})
			.then(tree => {
				if(tree.type != "tree") {
					return Promise.reject("Commit tree must be a tree");
				}

				tree.content.forEach(file => {
					file.type = {
						blob: "file",
						tree: "directory",
						submodule: "submodule"
					}[file.type] || "unknown";

					if(file.type == "submodule") {
						let submodule = submodules.find(submodule => submodule.path == (dir ? dir + "/" + file.name : file.name));
						if(submodule) {
							file.submodule = submodule;
						} else {
							file.type = "error";
						}
					}
				});

				return tree.content;
			});
	}

	// Returns file content
	getFile(branch, path) {
		return this.git.readBranchCommit(branch)
			.then(commit => {
				return this.git.readTreeItem(commit.content.tree, path);
			})
			.then(blob => {
				if(blob.type != "blob") {
					return Promise.reject("File content must be a blob");
				}

				return blob.content;
			});
	}

	// Returns branch list
	getBranches() {
		return this.git.getRefList()
			.then(refs => {
				return refs
					.filter(ref => (
						ref.indexOf("refs/heads/") == 0 ||
						ref.indexOf("refs/tags/") == 0
					));
			});
	}

	// Changes file content. Commits with message `message` on branch `base`
	saveFile(path, content, base, message) {
		let auth, author, commit, parent;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;

				return this.zeroFS.readFile("data/users/" + auth.address + "/data.json").catch(() => "{}");
			})
			.then(profile => {
				profile = JSON.parse(profile);

				let date = new Date;
				let tz = date.getTimezoneOffset() * -1;
				let hours = Math.floor(Math.abs(tz / 60));
				let minutes = Math.abs((tz + 60) % 60);
				tz = (tz > 0 ? "+" : "-") + (hours < 10 ? "0" : "") + hours + (minutes < 10 ? "0" : "") + minutes;

				author = profile.commitName || auth.user[0].toUpperCase() + auth.user.substr(1).replace(/@.*/, "");
				author += " <" + (profile.commitEmail || auth.user) + ">";
				author += " " + Math.floor(+date / 1000);
				author += " " + tz;

				return this.git.getBranchCommit(base);
			})
			.then(commitId => {
				parent = commitId;
				return this.git.readUnknownObject(commitId);
			})
			.then(commit => {
				return this.git.readUnknownObject(commit.content.tree);
			})
			.then(base => {
				return this.git.makeTreeDeltaPath(base.content, [
					{
						path: path,
						type: "blob",
						content: content
					}
				]);
			})
			.then(delta => {
				return this.git.writeCommit({
					tree: delta,
					parents: [parent],
					author: author,
					committer: author,
					message: message
				});
			})
			.then(c => {
				commit = c;
				if(!this.git.isSha(base)) {
					return this.git.setRef("refs/heads/" + base, commit);
				}
			})
			.then(() => commit);
	}

	// Uploads file (see `base` and `message` on saveFile())
	uploadFile(path, base, message) {
		return new Promise((resolve, reject) => {
			let input = document.createElement("input");
			input.type = "file";
			input.style.opacity = "0";
			input.onchange = () => {
				let fileReader = new FileReader();
				fileReader.onload = () => {
					let content = new Uint8Array(fileReader.result);
					resolve(this.saveFile(path, content, base, message));
				};
				fileReader.readAsArrayBuffer(input.files[0]);
			};
			document.body.appendChild(input);
			input.click();
		});
	}

	// Returns diff between commit and its parent (on merge commits uses 1st parent)
	diff(branch) {
		let commit;
		return this.git.readBranchCommit(branch)
			.then(c => {
				commit = c;

				// Compare root commit to empty tree
				if(commit.content.parents.length == 0) {
					return {
						content: {
							tree: "4b825dc642cb6eb9a060e54bf8d69288fbee4904" // Empty tree
						}
					};
				}
				return this.git.readBranchCommit(commit.content.parents[0]);
			})
			.then(base => {
				return this.diffTree(commit.content.tree, base.content.tree, "");
			})
			.then(diff => {
				return Promise.all(
					diff.map(item => {
						if(item.type == "blob") {
							// Diff all blobs

							let promise;
							if(item.action == "modified") {
								promise = this.diffBlob(item.id, item.baseId);
							} else if(item.action == "add") {
								promise = this.diffBlob(item.id, null);
							} else if(item.action == "remove") {
								promise = this.diffBlob(null, item.id);
							}

							return promise
								.then(diffBlob => {
									item.content = diffBlob;
									return item;
								});
						} else if(item.type == "submodule") {
							// Diff all submodules

							if(item.action == "modified") {
								item.content = this.diffSubmodule(item.id, item.baseId);
							} else if(item.action == "add") {
								item.content = this.diffSubmodule(item.id, null);
							} else if(item.action == "remove") {
								item.content = this.diffSubmodule(null, item.id);
							}

							return Promise.resolve(item);
						} else {
							return item;
						}
					})
				);
			});
	}

	// Diff tree against `base`. `root` is current path (empty string usually)
	diffTree(tree, base, root) {
		return Promise.all(
			[
				this.git.readUnknownObject(tree),
				this.git.readUnknownObject(base)
			]
		)
			.then(([tree, base]) => {
				let result = [];

				let promises = tree.content.map(item => {
					let baseItem = base.content.find(baseItem => baseItem.name == item.name);
					if(!baseItem) {
						if(item.type == "blob") {
							// File was added
							result.push({
								action: "add",
								id: item.id,
								name: item.name,
								type: "blob"
							});
							return Promise.resolve();
						} else if(item.type == "tree") {
							// Tree was added
							return this.diffTree(item.id, "4b825dc642cb6eb9a060e54bf8d69288fbee4904", root ? root + "/" + item.name : item.name)
								.then(diff => {
									result = result.concat(diff);
								});
						} else if(item.type == "submodule") {
							// Submodule was added
							result.push({
								action: "add",
								id: item.id,
								name: item.name,
								type: "submodule"
							});
							return Promise.resolve();
						}
					} else if(item.type == baseItem.type && item.id != baseItem.id) {
						if(item.type == "blob") {
							// Blob was modified
							result.push({
								action: "modified",
								id: item.id,
								baseId: baseItem.id,
								name: item.name,
								type: "blob"
							});
							return Promise.resolve();
						} else if(item.type == "tree") {
							// Tree was modified
							return this.diffTree(item.id, baseItem.id, root ? root + "/" + item.name : item.name)
								.then(diff => {
									result = result.concat(diff);
								});
						} else if(item.type == "submodule") {
							// Module was modified
							result.push({
								action: "modified",
								id: item.id,
								baseId: baseItem.id,
								name: item.name,
								type: "submodule"
							});
							return Promise.resolve();
						}
					} else if(item.type != baseItem.type) {
						if(item.type == "blob") {
							if(baseItem.type == "tree") {
								// Tree -> Blob
								return this.diffTree("4b825dc642cb6eb9a060e54bf8d69288fbee4904", baseItem.id, root ? root + "/" + item.name : item.name)
									.then(diff => {
										result = result.concat(diff);

										result.push({
											action: "add",
											id: item.id,
											name: item.name,
											type: "blob"
										});
									});
							} else if(baseItem.type == "submodule") {
								// Submodule -> Blob
								result.push({
									action: "remove",
									id: baseItem.id,
									name: item.name,
									type: "submodule"
								});
								result.push({
									action: "add",
									id: item.id,
									name: item.name,
									type: "blob"
								});
							}
						} else if(item.type == "tree") {
							return this.diffTree(item.id, "4b825dc642cb6eb9a060e54bf8d69288fbee4904", root ? root + "/" + item.name : item.name)
								.then(diff => {
									if(baseItem.type == "blob") {
										// Blob -> Tree
										result.push({
											action: "remove",
											id: baseItem.id,
											name: item.name,
											type: "blob"
										});
									} else if(baseItem.type == "submodule") {
										// Submodule -> Tree
										result.push({
											action: "remove",
											id: baseItem.id,
											name: item.name,
											type: "submodule"
										});
									}

									result = result.concat(diff);
								});
						} else if(item.type == "submodule") {
							if(baseItem.type == "tree") {
								// Tree -> Submodule
								return this.diffTree("4b825dc642cb6eb9a060e54bf8d69288fbee4904", baseItem.id, root ? root + "/" + item.name : item.name)
									.then(diff => {
										result = result.concat(diff);

										result.push({
											action: "add",
											id: item.id,
											name: item.name,
											type: "submodule"
										});
									});
							} else if(baseItem.type == "blob") {
								// Blob -> Submodule
								result.push({
									action: "remove",
									id: baseItem.id,
									name: item.name,
									type: "blob"
								});
								result.push({
									action: "add",
									id: item.id,
									name: item.name,
									type: "submodule"
								});
							}
						}
					}
				});
				let promises2 = base.content.map(baseItem => {
					let item = tree.content.find(item => item.name == baseItem.name);
					if(item) {
						return Promise.resolve();
					}

					if(baseItem.type == "blob") {
						// Removed blob
						result.push({
							action: "remove",
							id: baseItem.id,
							name: baseItem.name,
							type: "blob"
						});
						return Promise.resolve();
					} else if(baseItem.type == "tree") {
						// Removed tree
						return this.diffTree("4b825dc642cb6eb9a060e54bf8d69288fbee4904", baseItem.id, root ? root + "/" + baseItem.name : baseItem.name)
							.then(diff => {
								result = result.concat(diff);
							});
					} else if(item.type == "submodule") {
						// Removed submodule
						result.push({
							action: "remove",
							id: baseItem.id,
							name: baseItem.name,
							type: "submodule"
						});
						return Promise.resolve();
					}
				});

				return Promise.all(promises.concat(promises2))
					.then(() => result.map(item => {
						item.name = root ? root + "/" + item.name : item.name;
						return item;
					}));
			});
	}

	// Diffs two blobs using jsdifflib
	diffBlob(blob, base) {
		let blobContent;
		return (blob ? this.git.readUnknownObject(blob) : Promise.resolve({content: []}))
			.then(b => {
				if(b.content.length == 0) {
					blobContent = [];
				} else {
					blobContent = difflib.stringAsLines(this.git.decodeUTF8(b.content));
				}

				return base ? this.git.readUnknownObject(base) : {content: []};
			})
			.then(baseContent => {
				if(baseContent.content.length == 0) {
					baseContent = [];
				} else {
					baseContent = difflib.stringAsLines(this.git.decodeUTF8(baseContent.content));
				}

				let blobHasNewLine = blobContent.slice(-1)[0] == "";
				if(blobHasNewLine) {
					blobContent.pop();
				}

				let baseHasNewLine = baseContent.slice(-1)[0] == "";
				if(baseHasNewLine) {
					baseContent.pop();
				}

				let sequenceMatcher = new difflib.SequenceMatcher(baseContent, blobContent);
				let opcodes = sequenceMatcher.get_opcodes();
				let view = diffview.buildView({
					baseTextLines: baseContent,
					newTextLines: blobContent,
					opcodes: opcodes,
					// set the display titles for each resource
					baseTextName: "Base Text",
					newTextName: "New Text",
					contextSize: 3,
					viewType: 1
				});

				if(blobHasNewLine && !baseHasNewLine) {
					// Add newline
					let tr = document.createElement("tr");
					tr.innerHTML += "<th></th><th></th><td class='insert'>Newline at the end of file</td>";
					view.lastChild.appendChild(tr);
				} else if(!blobHasNewLine && baseHasNewLine) {
					// Remove newline
					let tr = document.createElement("tr");
					tr.innerHTML += "<th></th><th></th><td class='delete'>No newline at the end of file</td>";
					view.lastChild.appendChild(tr);
				}

				return view;
			});
	}

	// Returns diff view for submodule
	diffSubmodule(submodule, base) {
		let baseContent = base ? difflib.stringAsLines("Subproject commit " + base) : [];
		let submoduleContent = submodule ? difflib.stringAsLines("Subproject commit " + submodule) : [];

		let sequenceMatcher = new difflib.SequenceMatcher(baseContent, submoduleContent);
		let opcodes = sequenceMatcher.get_opcodes();
		let view = diffview.buildView({
			baseTextLines: baseContent,
			newTextLines: submoduleContent,
			opcodes: opcodes,
			// set the display titles for each resource
			baseTextName: "Base Text",
			newTextName: "New Text",
			contextSize: null,
			viewType: 1
		});

		return view;
	}

	/********************************** Releases **********************************/

	// Returns release list
	getReleases() {
		let tags, releases;

		return this.git.getRefList()
			.then(refs => {
				return refs
					.filter(ref => ref.indexOf("refs/tags/") == 0)
					.map(ref => ref.replace("refs/tags/", ""));
			})
			.then(tags => {
				return Promise.all(
					tags.map(tag => {
						return this.git.getRef("refs/tags/" + tag)
							.then(commit => this.git.readUnknownObject(commit))
							.then(commit => {
								let author = commit.content.committer || commit.content.tagger;
								let name = author.substr(0, author.indexOf("<")).trim();
								let email = author.substr(0, author.indexOf(">")).substr(author.indexOf("<") + 1);
								let timestamp = author.substr(author.indexOf(">") + 1).trim().split(" ");
								let tz = timestamp[1];
								let offset = (new Date).getTimezoneOffset() * -1;

								let utcDate = (parseInt(timestamp[0]) + (tz.substr(1, 2) * 3600 + tz.substr(3, 2) * 60) * (tz[0] == "+" ? 1 : -1)) * 1000;
								let relativeDate = utcDate - offset * 60000;
								let offsetString = offset == 0 ? "UTC" : "GMT " + (offset < 0 ? "-" : "+") + (Math.abs(offset) / 60) + ":" + (Math.abs(offset) % 60 >= 10 ? "" : "0") + (Math.abs(offset) % 60);

								let dateString = this.translateDate(relativeDate);

								if(commit.type == "tag") {
									// Annotated tag
									let title = commit.content.message.match(/^(.*?)\n/)[1].trim();
									let description = commit.content.message.replace(title, "").trim();

									return {
										tag: tag,
										title: title,
										description: description,
										dateString: dateString,
										date: relativeDate
									};
								} else {
									// Lightweight tag
									return {
										tag: tag,
										title: tag,
										description: "",
										dateString: dateString,
										date: relativeDate
									};
								}
							});
					})
				);
			})
			.then(r => {
				releases = r.sort((a, b) => {
					return a.date - b.date;
				});

				return this.getContent();
			})
			.then(content => {
				if(content.not_releases) {
					return releases.filter(release => {
						return content.not_releases.indexOf(release.tag) == -1;
					});
				}

				return releases;
			});
	}

	// Marks tag as `not release`
	removeRelease(tag) {
		return this.getContent()
			.then(content => {
				if(!content.not_releases) {
					content.not_releases = [];
				}

				content.not_releases.push(tag);

				return this.setContent(content);
			})
			.then(() => {
				return this.signContent();
			});
	}

	/******************************** Issues / PRs ********************************/
	// Fallback to RepositoryIssues

	// Issues
	addIssue(...args) {
		return this.issues.addIssue(...args);
	}
	changeIssue(...args) {
		return this.issues.changeIssue(...args);
	}
	changeIssueTags(...args) {
		return this.issues.changeIssueTags(...args);
	}
	removeIssue(...args) {
		return this.issues.removeIssue(...args);
	}
	getIssues(...args) {
		return this.issues.getIssues(...args);
	}
	getIssue(...args) {
		return this.issues.getIssue(...args);
	}
	getIssueComments(...args) {
		return this.issues.getIssueComments(...args);
	}
	getIssueActions(...args) {
		return this.issues.getIssueActions(...args);
	}
	addIssueComment(...args) {
		return this.issues.addIssueComment(...args);
	}
	changeIssueComment(...args) {
		return this.issues.changeIssueComment(...args);
	}
	removeIssueComment(...args) {
		return this.issues.removeIssueComment(...args);
	}
	changeIssueStatus(...args) {
		return this.issues.changeIssueStatus(...args);
	}

	// Pull requests
	addPullRequest(...args) {
		return this.issues.addPullRequest(...args);
	}
	changePullRequest(...args) {
		return this.issues.changePullRequest(...args);
	}
	changePullRequestTags(...args) {
		return this.issues.changePullRequestTags(...args);
	}
	removePullRequest(...args) {
		return this.issues.removePullRequest(...args);
	}
	getPullRequests(...args) {
		return this.issues.getPullRequests(...args);
	}
	getPullRequest(...args) {
		return this.issues.getPullRequest(...args);
	}
	getPullRequestComments(...args) {
		return this.issues.getPullRequestComments(...args);
	}
	getPullRequestActions(...args) {
		return this.issues.getPullRequestActions(...args);
	}
	addPullRequestComment(...args) {
		return this.issues.addPullRequestComment(...args);
	}
	changePullRequestComment(...args) {
		return this.issues.changePullRequestComment(...args);
	}
	removePullRequestComment(...args) {
		return this.issues.removePullRequestComment(...args);
	}
	changePullRequestStatus(...args) {
		return this.issues.changePullRequestStatus(...args);
	}

	/********************************** Markdown **********************************/

	// Sets `originalBody` of comment to `body`, sets `body` to parsed `body`
	highlightComment(comment) {
		comment.originalBody = comment.body;
		comment.body = this.renderMarked(comment.body);
		return comment;
	}

	// Sets options for marked
	setUpMarked() {
		if(!this.markedOptions) {
			let issueParser = "<a href=\"/1GitLiXB6t5r8vuU2zC6a8GYj9ME6HMQ4t/repo/issues/view/?" + this.address + "/$1@$2\">#$1@$2</a>";
			let pullRequestParser = "<a href=\"/1GitLiXB6t5r8vuU2zC6a8GYj9ME6HMQ4t/repo/pull-requests/view/?" + this.address + "/$1@$2\">#P$1@$2</a>";

			let renderer = new marked.Renderer();
			renderer.text = function(text) {
				return text
					.replace(/#(\d+)@(1[A-Za-z0-9]{25,34})/g, "[ISSUEID]$1|$2[/ISSUEID]")
					.replace(/#[Pp](\d+)@(1[A-Za-z0-9]{25,34})/g, "[PULLREQUESTID]$1|$2[/PULLREQUESTID]");
			};
			renderer.link = function(link, title, text) {
				let res = this.__proto__.link.call(this, link, title, text); // super() analog
				return res
					.replace(/\[ISSUEID\](.+?)\|(.+?)\[\/ISSUEID\]/g, "#$1@$2")
					.replace(/\[PULLREQUESTID\](.+?)\|(.+?)\[\/PULLREQUESTID\]/g, "#P$1@$2");
			};
			renderer.listitem = function(text) {
				let checkbox = false;
				let value = false;
				if(text.indexOf("[ ]") == 0) {
					checkbox = true;
					value = false;
				} else if(text.indexOf("[x]") == 0 || text.indexOf("[v]") == 0) {
					checkbox = true;
					value = true;
				}

				if(checkbox) {
					let label = text.substr(3).trim();
					let id = "checkbox_" + Math.random().toString(36).substr(2) + "_" + label.replace(/[^A-Za-z0-9\-_]/g);
					return "\
						<li>\
							<input type='checkbox' id='" + id + "'" + (value ? " checked" : "") + " disabled>\
							<label for='" + id + "'>" + label + "</label>\
						</li>\
					\n";
				}

				return "<li>" + text + "</li>\n";
			};
			renderer.all = function(text) {
				return text
					.replace(/\[ISSUEID\](.+?)\|(.+?)\[\/ISSUEID\]/g, issueParser)
					.replace(/\[PULLREQUESTID\](.+?)\|(.+?)\[\/PULLREQUESTID\]/g, pullRequestParser);
			};

			this.markedOptions = {
				highlight: (code, lang) => {
					try {
						return lang ? hljs.highlight(lang, code).value : hljs.highlightAuto(code).value;
					} catch(e) {
						return hljs.highlightAuto(code).value;
					}
				},
				renderer: renderer
			};
			marked.setOptions(this.markedOptions);
		}
	}

	// Renders markdown using marked (first sets it up)
	renderMarked(text) {
		this.setUpMarked();
		return this.markedOptions.renderer.all(marked(text));
	}

	// Returns human-parsable string for action
	parseAction(action, context) {
		if(action.action == "changeStatus") {
			return action.cert_user_id + " " + (action.param == "close" ? "closed" : "reopened") + " " + context + " " + this.translateDate(action.date_added);
		} else if(action.action == "changeTags") {
			return action.cert_user_id + " changed tags: " + action.param + " " + this.translateDate(action.date_added);
		} else if(action.action == "addTags" || action.action == "removeTags") {
			let tags = "tag" + (action.param.indexOf(",") == -1 ? "" : "s") + " ";
			tags += (
				action.param
					.split(",")
					.map(tag => tag.trim())
					.filter(tag => tag.length)
					.map((tag, i) => {
						let color = repo.tagToColor(tag);
						let map = {
							"&": "&amp;",
							"<": "&lt;",
							">": "&gt;",
							"\"": "&quot;",
							"'": "&#039;"
						};
						let tagHTML = tag.replace(/[&<>"']/g, m => map[m]);

						return "\
							<a\
								class='tag'\
								style='\
									background-color: " + color.background + " !important;\
									color: " + color.foreground + " !important;" +
									(i == 0 ? "margin-left: 0;" : "") +
								"'\
								href='../../filter/?" + this.address + "/tag:" + tag + "'\
							>" +
								tagHTML +
							"</a>";
					})
					.join("")
			);

			let text = {
				addTags: "added",
				removeTags: "removed"
			}[action.action];
			return action.cert_user_id + " " + text + " " + tags + " " + this.translateDate(action.date_added);
		}
	}

	/************************************ Muted ***********************************/

	// Returns array of muted usernames
	getMuted() {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/data/users/content.json")
			.then(content => {
				content = JSON.parse(content);

				return Object.keys(content.user_contents.permissions)
					.filter(username => content.user_contents.permissions[username] == false);
			});
	}

	// Mutes username
	mute(name) {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/data/users/content.json")
			.then(content => {
				content = JSON.parse(content);

				content.user_contents.permissions[name] = false;

				content = JSON.stringify(content, null, "\t");

				return this.zeroFS.writeFile("merged-GitCenter/" + this.address + "/data/users/content.json", content);
			})
			.then(() => {
				return this.signAndPublish("merged-GitCenter/" + this.address + "/data/users/content.json", "site");
			});
	}

	// Unmutes username
	unmute(name) {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/data/users/content.json")
			.then(content => {
				content = JSON.parse(content);

				if(content.user_contents.permissions[name] == false) {
					delete content.user_contents.permissions[name];
				}

				content = JSON.stringify(content, null, "\t");

				return this.zeroFS.writeFile("merged-GitCenter/" + this.address + "/data/users/content.json", content);
			})
			.then(() => {
				return this.signAndPublish("merged-GitCenter/" + this.address + "/data/users/content.json", "site");
			});
	}

	/*********************************** ZeroID ***********************************/

	// Reads `name` file of ZeroID and caches it
	getZeroIdFile(name, cache, property) {
		if(this[cache]) {
			return Promise.resolve(this[cache]);
		}

		let worker = new WorkerOut();

		return this.zeroFS.readFile("cors-1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz/" + name, false, true)
			.then(users => {
				return worker.JSON.parse(users);
			})
			.then(u => {
				this[cache] = u[property];
				return this[cache];
			});
	}

	// Returns user info by auth address
	findUserById(id) {
		return this.getZeroIdFile("data/users.json", "_cached_users_json", "users")
			.then(users => {
				let userName = Object.keys(users).find(userName => {
					return users[userName].split(",")[1] == id;
				});
				if(userName) {
					let info = users[userName].split(",");
					return {
						name: userName,
						type: info[0],
						id: info[1],
						hash: info[2]
					};
				}

				return this.getZeroIdFile("data/users_archive.json", "_cached_users_archive_json", "users")
					.then(users => {
						let userName = Object.keys(users).find(userName => {
							return users[userName].split(",")[1] == id;
						});
						if(userName) {
							let info = users[userName].split(",");
							return {
								name: userName,
								type: info[0],
								id: info[1],
								hash: info[2]
							};
						}

						let userNames = Object.keys(users).filter(userName => {
							return users[userName][0] == "@" && id.indexOf(users[userName].split(",")[1]) == 0;
						});

						if(userNames.length == 0) {
							return Promise.reject("ID " + id + " was not found");
						}

						let resolver, rejecter;
						let resulted = 0;
						let promise = new Promise((resolve, reject) => {
							resolver = resolve;
							rejecter = reject;
						});

						userNames.forEach(userName => {
							let pack = users[userName].substr(1).split(",")[0];
							this.getZeroIdFile("data/certs_" + pack + ".json", "_cached_pack_" + pack, "certs")
								.then(users => {
									let userName = Object.keys(users).find(userName => {
										return users[userName].split(",")[1] == id;
									});
									if(userName) {
										let info = users[userName].split(",");
										resolver({
											name: userName,
											type: info[0],
											id: info[1],
											hash: info[2]
										});
										return;
									}


									resulted++;
									if(resulted == userNames.length) {
										rejecter("ID " + id + " was not found");
									}
								});
						});

						return promise;
					});
			});
	}

	// Returns user info by ZeroID name
	findUserByName(userName) {
		return this.getZeroIdFile("data/users.json", "_cached_users_json", "users")
			.then(users => {
				if(users[userName]) {
					return {
						name: userName,
						type: info[0],
						id: info[1],
						hash: info[2]
					};
				}

				return this.getZeroIdFile("data/users_archive.json", "_cached_users_archive_json", "users")
					.then(users => {
						if(!users[userName]) {
							return Promise.reject("User " + userName + " was not found");
						}

						if(users[userName][0] != "@") {
							let info = users[userName].split(",");
							return {
								name: userName,
								type: info[0],
								id: info[1],
								hash: info[2]
							};
						}

						let pack = users[userName].substr(1).split(",")[0];

						return this.getZeroIdFile("data/certs_" + pack + ".json", "_cached_pack_" + pack, "certs")
							.then(users => {
								if(users[userName]) {
									let info = users[userName].split(",");
									return {
										name: userName,
										type: info[0],
										id: info[1],
										hash: info[2]
									};
								}

								return Promise.reject("User " + userName + " was not found");
							});
					});
			});
	}

	/********************************* Maintainers ********************************/

	// Returns maintainer list as array of usernames (deprecated)
	getMaintainers() {
		let signers;

		return this.getContent()
			.then(content => {
				signers = content.signers || [];

				return Promise.all(
					signers.map(signer => {
						return this.findUserById(signer).catch(() => null);
					})
				);
			})
			.then(userNames => userNames.filter(userName => userName));
	}

	// Removes maintainer from list (deprecated)
	removeMaintainer(name) {
		let cert, content, signers;
		return this.findUserByName(name)
			.then(c => {
				cert = c;

				return this.getContent();
			})
			.then(c => {
				content = c;
				if(content.signers) {
					let index = content.signers.indexOf(cert.id);
					if(index != -1) {
						content.signers.splice(index, 1);
					}
				}

				return this.setContent(content);
			})
			.then(() => {
				return this.signContent();
			});
	}

	// Adds maintainer to list (deprecated)
	addMaintainer(name, signStyle) {
		let cert, content, signers;
		return this.findUserByName(name)
			.then(c => {
				cert = c;

				return this.getContent();
			})
			.then(c => {
				content = c;

				if(!content.signers) {
					content.signers = [];
				}

				let index = content.signers.indexOf(cert.id);
				if(index == -1) {
					content.signers.push(cert.id);
				}

				return this.setContent(content);
			})
			.then(() => {
				return this.signContent(signStyle);
			});
	}

	/*********************************** Follow ***********************************/

	// Follow current repository issues and pull requests
	follow() {
		return this.zeroPage.cmd("feedListFollow")
			.then(feedList => {
				if(!feedList["Issues"]) {
					feedList["Issues"] = [FOLLOW_QUERIES.objects, []];
				}
				if(!feedList["Pull requests"]) {
					feedList["Pull requests"] = [FOLLOW_QUERIES.pullRequests, []];
				}
				if(!feedList["Issue comments"]) {
					feedList["Issue comments"] = [FOLLOW_QUERIES.issueComments, []];
				}
				if(!feedList["Pull request comments"]) {
					feedList["Pull request comments"] = [FOLLOW_QUERIES.pullRequestComments, []];
				}
				if(!feedList["Actions"]) {
					feedList["Actions"] = [FOLLOW_QUERIES.actions, []];
				}

				Object.values(feedList).forEach(feed => feed[1].push(this.address));

				return this.zeroPage.cmd("feedFollow", [feedList]);
			});
	}

	// Unfollow current repository issues and pull requests
	unfollow() {
		return this.zeroPage.cmd("feedListFollow")
			.then(feedList => {
				Object.values(feedList).forEach(feed => {
					let index = feed[1].indexOf(this.address);
					if(index > -1) {
						feed[1].splice(index, 1);
					}
				});

				return this.zeroPage.cmd("feedFollow", [feedList]);
			});
	}

	// Installs new version of follow list
	updateFollow() {
		return this.zeroPage.cmd("feedListFollow")
			.then(feedList => {
				let changed = false;

				if(feedList["Issues"] && feedList["Issues"][0] != FOLLOW_QUERIES.issues) {
					feedList["Issues"][0] = FOLLOW_QUERIES.issues;
					changed = true;
				} else if(!feedList["Issues"]) {
					feedList["Issues"] = [FOLLOW_QUERIES.issues, this.getFollowListFor(feedList)];
					changed = true;
				}

				if(feedList["Pull requests"] && feedList["Pull requests"][0] != FOLLOW_QUERIES.pullRequests) {
					feedList["Pull requests"][0] = FOLLOW_QUERIES.pullRequests;
					changed = true;
				} else if(!feedList["Pull requests"]) {
					feedList["Pull requests"] = [FOLLOW_QUERIES.pullRequests, this.getFollowListFor(feedList)];
					changed = true;
				}

				if(feedList["Issue comments"] && feedList["Issue comments"][0] != FOLLOW_QUERIES.issueComments) {
					feedList["Issue comments"][0] = FOLLOW_QUERIES.issueComments;
					changed = true;
				} else if(!feedList["Issue comments"]) {
					feedList["Issue comments"] = [FOLLOW_QUERIES.issueComments, this.getFollowListFor(feedList)];
					changed = true;
				}

				if(feedList["Pull request comments"] && feedList["Pull request comments"][0] != FOLLOW_QUERIES.pullRequestComments) {
					feedList["Pull request comments"][0] = FOLLOW_QUERIES.pullRequestComments;
					changed = true;
				} else if(!feedList["Pull request comments"]) {
					feedList["Pull request comments"] = [FOLLOW_QUERIES.pullRequestComments, this.getFollowListFor(feedList)];
					changed = true;
				}

				if(feedList["Actions"] && feedList["Actions"][0] != FOLLOW_QUERIES.actions) {
					feedList["Actions"][0] = FOLLOW_QUERIES.actions;
					changed = true;
				} else if(!feedList["Actions"]) {
					feedList["Actions"] = [FOLLOW_QUERIES.actions, this.getFollowListFor(feedList)];
					changed = true;
				}

				if(changed) {
					return this.zeroPage.cmd("feedFollow", [feedList]);
				}
			});
	}

	// Merge and unique
	getFollowListFor(feedList) {
		return Object.values(feedList)
			.map(data => data[1])
			.reduce((arr, val) => arr.concat(val), [])
			.filter((val, i, arr) => arr.indexOf(val) == i);
	}

	// Returns whether you are following current repository
	isFollowing() {
		return this.zeroPage.cmd("feedListFollow")
			.then(feedList => {
				return (
					Object.values(feedList).length > 0 &&
					Object.values(feedList).every(feed => feed[1].indexOf(this.address) > -1)
				);
			});
	}

	/************************************ Index ***********************************/

	// Add current repository to index
	addToIndex() {
		let content, auth;
		return this.getContent()
			.then(c => {
				content = c;

				return this.zeroAuth.requestAuth();
			})
			.then(a => {
				auth = a;

				return this.zeroFS.readFile("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/data.json")
					.then(data => JSON.parse(data))
					.catch(() => { return {}; });
			})
			.then(data => {
				if(!data.repo_index) {
					data.repo_index = {};
				}

				data.repo_index[this.address] = {
					title: content.title,
					description: content.description
				};

				data = JSON.stringify(data, null, "\t");

				return this.zeroFS.writeFile("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/data.json", data);
			})
			.then(() => {
				return this.signAndPublish("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/content.json");
			});
	}

	// Remove current repository from index
	removeFromIndex() {
		let auth;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;
				return this.zeroFS.readFile("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/data.json")
					.then(data => JSON.parse(data))
					.catch(() => {});
			})
			.then(data => {
				if(!data.repo_index) {
					data.repo_index = {};
				}

				delete data.repo_index[this.address];

				data = JSON.stringify(data, null, "\t");

				return this.zeroFS.writeFile("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/data.json", data);
			})
			.then(() => {
				return this.signAndPublish("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/content.json");
			})
			.then(() => {
				return this.zeroDB.query("SELECT repo_index.*, json.cert_user_id FROM repo_index, json WHERE repo_index.json_id = json.json_id AND repo_index.address = :address", {
					address: this.address
				});
			})
			.then(addresses => {
				let indexers = addresses.map(address => address.cert_user_id);
				return indexers.length ? indexers : false;
			});
	}

	// Returns bitmask for repository place in index
	isInIndex() {
		// 0b01
		//   ^^ indexed by somebody else
		//   | indexed by you
		return this.zeroDB.query("SELECT repo_index.*, json.cert_user_id FROM repo_index, json WHERE repo_index.json_id = json.json_id AND repo_index.address = :address", {
			address: this.address
		})
			.then(addresses => {
				let auth = this.zeroAuth.getAuth();
				let indexedByYou = auth && addresses.some(address => address.cert_user_id == auth.user);
				let indexedBySomebody = addresses.length > (indexedByYou ? 1 : 0);

				return (indexedByYou << 1) | indexedBySomebody;
			});
	}

	// Returns indexer list
	getIndexers() {
		return this.zeroDB.query("SELECT repo_index.*, json.cert_user_id FROM repo_index, json WHERE repo_index.json_id = json.json_id AND repo_index.address = :address", {
			address: this.address
		})
			.then(addresses => {
				return addresses.map(address => address.cert_user_id);
			});
	}

	/********************************** Starring **********************************/

	// Return {starred: is starred by you, count: total star count}
	getStars() {
		let auth = this.zeroAuth.getAuth();

		return this.zeroDB.query("SELECT repo_stars.*, json.directory FROM repo_stars, json WHERE repo_stars.address = :address AND repo_stars.json_id = json.json_id AND repo_stars.star != 0", {
			address: this.address
		})
			.then(res => {
				return {
					starred: auth && res.find(row => row.directory == "data/users/" + auth.address),
					count: res.length
				};
			});
	}

	// Stars/unstars repository (based on current value) and returns getStars() result
	star() {
		let auth, starred;

		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;
				return this.zeroFS.readFile("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/data.json")
					.catch(() => "");
			})
			.then(data => {
				try {
					data = JSON.parse(data);
				} catch(e) {
					data = {};
				}

				if(!data.repo_stars) {
					data.repo_stars = {};
				}

				data.repo_stars[this.address] = !data.repo_stars[this.address];
				starred = data.repo_stars[this.address];

				data = JSON.stringify(data, null, "\t");

				return this.zeroFS.writeFile("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/data.json", data);
			})
			.then(() => {
				return this.signAndPublish("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/content.json");
			})
			.then(() => {
				return this.zeroDB.query("SELECT COUNT(*) AS count FROM repo_stars WHERE repo_stars.address = :address AND repo_stars.star != 0", {
					address: this.address
				});
			})
			.then(res => {
				return {
					starred: starred,
					count: res[0].count
				};
			});
	}

	/****************************** Helper functions ******************************/

	// Translates time and date from timestamp to human-readable format
	translateDate(date) {
		date = new Date(date);

		let delta = Math.floor((+new Date - date) / 1000);

		if(delta < 30) {
			return "just now";
		} else if(delta < 60) {
			return delta + " seconds ago";
		} else if(delta < 60 * 2) {
			return "a minute ago";
		} else if(delta < 60 * 60) {
			return Math.floor(delta / 60) + " minutes ago";
		} else if(Math.floor(delta / 60 / 60) == 1) {
			return "1 hour ago";
		} else if(delta < 60* 60 * 24) {
			return Math.floor(delta / 60 / 60) + " hours ago";
		} else if(delta < 60 * 60 * 24 * 2) {
			return "yesterday";
		} else {
			let month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];

			return (
				"on " +
				month + " " +
				date.getDate() + " " +
				date.getFullYear()
			);
		}
	}

	// Translates time from timestamp to human-readable format (deprecated)
	translateTime(date) {
		date = new Date(date);

		return (
			date.getHours() + ":" +
			(date.getMinutes() >= 10 ? "" : "0") + date.getMinutes() + ":" +
			(date.getSeconds() >= 10 ? "" : "0") + date.getSeconds()
		);
	}

	// Returns log
	getCommits(leaf, count) {
		let heads = [];
		let commits = [];

		return this.git.getBranchCommit(leaf)
			.then(l => {
				leaf = l;
				return this.git.toBidirectional([leaf], count);
			})
			.then(bidirectional => {
				let action = leaf => {
					if(commits.length >= count) {
						return;
					}

					commits.push(leaf);
					for(let i = leaf.content.parents.length - 1; i >= 0; i--) {
						let parent = leaf.content.parents[i];
						if(parent.content.children.indexOf(leaf) > 0) {
							// Branch delivered
							if(!leaf.content.delivered) {
								leaf.content.delivered = [];
							}

							leaf.content.delivered.push(parent);
							return;
						}

						action(parent);
					}
				};

				return action(bidirectional.leaves[0]);
			})
			.then(() => commits);
	}

	// Converts author (like "Name <email> timestamp") to text
	parseAuthor(author) {
		let name = author.substr(0, author.indexOf("<")).trim();
		let email = author.substr(0, author.indexOf(">")).substr(author.indexOf("<") + 1);
		let timestamp = author.substr(author.indexOf(">") + 1).trim().split(" ");
		let tz = timestamp[1];
		let offset = (new Date).getTimezoneOffset() * -1;

		let utcDate = (parseInt(timestamp[0]) + (tz.substr(1, 2) * 3600 + tz.substr(3, 2) * 60) * (tz[0] == "+" ? 1 : -1)) * 1000;
		let relativeDate = utcDate - offset * 60000;

		return name + " commited " + this.translateDate(relativeDate);
	}

	// Downloads data as octet-stream
	download(name, data) {
		let blob = new Blob([data], {type: "application/octet-stream"});
		let link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// Converts text to color
	tagToColor(tag) {
		tag = tag + tag + tag;

		let hash = 0;
		tag.split("").forEach(char => {
			hash = char.charCodeAt(0) * 100 + ((hash << 5) - hash);
		});
		hash &= 0xFFFFFF;

		let hue = Math.floor((hash & 0xFF) / 256 * 360);
		let saturation = Math.floor(((hash >> 8) & 0xFF) / 256 * 100);
		let lightness = Math.floor(((hash >> 16) & 0xFF) / 256 * 50);
		let background = "hsl(" + hue + ", " + saturation + "%, " + lightness + "%)";

		return {
			background: background,
			foreground: "#FFF"
		};
	}
};

Repository.createRepo = zeroPage => {
	return zeroPage.cmd("siteClone", ["1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6"]);
};