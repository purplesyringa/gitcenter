FOLLOW_QUERIES = {
	issues: "SELECT 'issue' AS type, issues.date_added AS date_added, issues.title AS title, issues.body AS body, 'repo/issues/view/?' || json.site || '/' || issues.id || '@' || REPLACE(json.directory, 'data/users/', '') AS url FROM issues, json WHERE issues.json_id = json.json_id AND json.site IN (:params)",
	pullRequests: "SELECT 'pull_request' AS type, pull_requests.date_added AS date_added, pull_requests.title AS title, pull_requests.body AS body, 'repo/pull-requests/view/?' || json.site || '/' || pull_requests.id || '@' || REPLACE(json.directory, 'data/users/', '') AS url FROM pull_requests, json WHERE pull_requests.json_id = json.json_id AND json.site IN (:params)",
	issueComments: "\
		SELECT\
			'comment' AS type, issue_comments.date_added AS date_added, issues_json.title AS title, '@' || REPLACE(cert_user_id, '@zeroid.bit', '') || ': ' || issue_comments.body AS body, 'repo/issues/view/?' || issues_json.site || '/' || issues_json.id || '@' || REPLACE(issues_json.directory, 'data/users/', '') AS url\
		FROM\
			issue_comments\
		LEFT JOIN\
			(SELECT id, title, body, json_id, site, directory FROM issues LEFT JOIN json USING (json_id)) AS issues_json\
		ON\
			(issue_comments.issue_id = issues_json.id AND issue_comments.issue_json = issues_json.directory)\
		LEFT JOIN\
			(SELECT cert_user_id, json_id AS comment_json_id FROM json) AS comment_json\
		ON\
			(comment_json.comment_json_id = issue_comments.json_id)\
		WHERE\
			issues_json.site IN (:params) AND issue_comments.json_id IN (SELECT json_id FROM json WHERE json.site = issues_json.site)\
	",
	pullRequestComments: "\
		SELECT\
			'comment' AS type, pull_request_comments.date_added AS date_added, pull_requests_json.title AS title, '@' || REPLACE(cert_user_id, '@zeroid.bit', '') || ': ' || pull_request_comments.body AS body, 'repo/pull-requests/view/?' || pull_requests_json.site || '/' || pull_requests_json.id || '@' || REPLACE(pull_requests_json.directory, 'data/users/', '') AS url\
		FROM\
			pull_request_comments\
		LEFT JOIN\
			(SELECT id, title, body, json_id, site, directory FROM pull_requests LEFT JOIN json USING (json_id)) AS pull_requests_json\
		ON\
			(pull_request_comments.pull_request_id = pull_requests_json.id AND pull_request_comments.pull_request_json = pull_requests_json.directory)\
		LEFT JOIN\
			(SELECT cert_user_id, json_id AS comment_json_id FROM json) AS comment_json\
		ON\
			(comment_json.comment_json_id = pull_request_comments.json_id)\
		WHERE\
			pull_requests_json.site IN (:params) AND pull_request_comments.json_id IN (SELECT json_id FROM json WHERE json.site = pull_requests_json.site)\
	",
};

class Repository {
	constructor(address, zeroPage) {
		this.address = address;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
		this.zeroAuth = new ZeroAuth(zeroPage);
		this.zeroDB = new ZeroDB(zeroPage);
	}

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
	getLocalCache() {
		return this.zeroPage.cmd("wrapperGetLocalStorage")
			.then(storage => {
				if(!storage || !storage.repoCache || !storage.repoCache[this.address]) {
					return {};
				}

				return storage.repoCache[this.address];
			})
	}
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

	// Permission actions
	addMerger() {
		let siteInfo, list;
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
			.then(content => {
				if(content.git) {
					this.git = new Git("merged-GitCenter/" + this.address + "/" + content.git, zeroPage);
					this.hg = null;
					return this.git.init();
				} else if(content.hg) {
					this.git = null;
					this.hg = new Hg("merged-GitCenter/" + this.address + "/" + content.hg, zeroPage);
					return this.hg.init();
				} else {
					this.git = null;
					this.hg = null;
				}
			})
			.then(() => {
				return this.updateFollow();
			});
	}
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

	// Content actions
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
	getContent() {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/content.json", true)
			.then(content => JSON.parse(content));
	}
	setContent(content) {
		return this.zeroFS.writeFile("merged-GitCenter/" + this.address + "/content.json", JSON.stringify(content, null, "\t"));
	}
	signContent(signStyle) {
		return this.signAndPublish("merged-GitCenter/" + this.address + "/content.json", signStyle);
	}
	sign() {
		return this.zeroPage.cmd("siteSign", {inner_path: "merged-GitCenter/" + this.address + "/content.json"})
			.then(res => {
				if(res != "ok") {
					return Promise.reject(res);
				}
			});
	}

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
	getOwner() {
		let address;

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
			})
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

	rename(newName) {
		return this.getContent()
			.then(content => {
				content.title = newName;
				return this.setContent(content);
			})
			.then(() => this.sign());
	}
	changeDescription(description) {
		return this.getContent()
			.then(content => {
				content.description = description;
				return this.setContent(content);
			})
			.then(() => this.sign());
	}
	changeHooks(hooks) {
		return this.getContent()
			.then(content => {
				content.hooks = hooks;
				return this.setContent(content);
			})
			.then(() => this.sign());
	}
	install(title, description, address, type) {
		if(type == "git") {
			return this.installGit(title, description, address);
		} else if(type == "hg") {
			return this.installHg(title, description, address);
		}
	}
	installGit(title, description, address) {
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
				return this.zeroFS.readFile("data/users/" + auth.address + "/data.json").catch(() => "{}");
			})
			.then(profile => {
				profile = JSON.parse(profile);

				profile.commitName = profile.commitName || auth.user[0].toUpperCase() + auth.user.substr(1).replace(/@.*/, "");
				profile.commitEmail = profile.commitEmail || auth.user;

				return Git.init("merged-GitCenter/" + this.address + "/" + address, this.zeroPage, profile.commitName, profile.commitEmail);
			})
			.then(git => {
				this.git = git;
				return this.signContent("site");
			});
	}
	installHg(title, description, address) {
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
				content.hg = address;
				content.hooks = false;
				return this.setContent(content);
			})
			.then(() => {
				return this.zeroFS.readFile("data/users/" + auth.address + "/data.json").catch(() => "{}");
			})
			.then(profile => {
				profile = JSON.parse(profile);

				profile.commitName = profile.commitName || auth.user[0].toUpperCase() + auth.user.substr(1).replace(/@.*/, "");
				profile.commitEmail = profile.commitEmail || auth.user;

				return Hg.init("merged-GitCenter/" + this.address + "/" + address, this.zeroPage, profile.commitName, profile.commitEmail);
			})
			.then(hg => {
				this.hg = hg;
				return this.signContent("site");
			});
	}
	fork() {
		return this.zeroPage.cmd("siteClone", [this.address])
	}

	// Git actions
	getFiles(branch, dir) {
		if(this.git) {
			return this.git.readBranchCommit(branch)
				.then(commit => {
					return this.getTree(commit.content.tree, dir);
				});
		} else if(this.hg) {
			return this.hg.readBranchCommit(branch)
				.then(commit => {
					return this.getTree(commit.content.manifest, dir);
				});
		}
	}
	getTree(tree, dir) {
		if(this.git) {
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
		} else if(this.hg) {
			return this.hg.readTree(tree, dir);
		}
	}
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
	getBranches() {
		return (this.git || this.hg).getRefList()
			.then(refs => {
				return refs
					.filter(ref => (
						ref.indexOf("refs/heads/") == 0 ||
						ref.indexOf("refs/tags/") == 0
					));
			});
	}
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
	diff(branch) {
		let commit;
		return this.git.readBranchCommit(branch)
			.then(c => {
				commit = c;

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
	diffBlob(blob, base) {
		let blobContent;
		return (blob ? this.git.readUnknownObject(blob) : Promise.resolve({content: []}))
			.then(b => {
				if(b.content.length == 0) {
					blobContent = [];
				} else {
					blobContent = difflib.stringAsLines(this.git.arrayToString(b.content));
				}

				return base ? this.git.readUnknownObject(base) : {content: []};
			})
			.then(baseContent => {
				if(baseContent.content.length == 0) {
					baseContent = [];
				} else {
					baseContent = difflib.stringAsLines(this.git.arrayToString(baseContent.content));
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

	// Releases
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

								let dateString = this.translateDate(relativeDate) + " " + this.translateTime(relativeDate) + " " + offsetString;

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

	// Issues
	addIssue(title, content, tags) {
		let auth, row;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;

				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
					"issues",
					{
						title: title,
						body: content,
						date_added: Date.now(),
						open: 1,
						reopened: 0,
						tags: tags.join(",")
					},
					{
						source: "next_issue_id",
						column: "id"
					}
				);
			})
			.then(row => {
				row.json = "data/users/" + auth.address;
				return row;
			});
	}
	getIssues(page) {
		return this.zeroDB.query("SELECT issues.*, json.directory as json, json.cert_user_id FROM issues, json WHERE issues.json_id = json.json_id AND json.site = :address LIMIT " + (page * 10) + ", 11", {
			address: this.address
		})
			.then(issues => {
				return {
					issues: issues.slice(0, 10)
						.map(issue => {
							issue.tags = issue.tags ? issue.tags.split(",") : [];
							return issue;
						}),
					nextPage: issues.length > 10
				};
			});
	}
	getIssue(id, json) {
		let issue;
		return this.zeroDB.query("SELECT issues.*, json.directory, json.cert_user_id FROM issues, json WHERE issues.json_id = json.json_id AND json.directory = :json AND issues.id = :id AND json.site = :address", {
			json: json,
			id: id,
			address: this.address
		})
			.then(i => {
				issue = i[0];
				issue.tags = issue.tags ? issue.tags.split(",") : [];

				return this.isSignable(issue.directory + "/content.json");
			})
			.then(signable => {
				issue.owned = signable;
				return issue;
			});
	}
	getIssueComments(id, json) {
		return this.zeroDB.query("\
			SELECT\
				-1 AS id,\
				issues.body AS body,\
				issues.date_added AS date_added,\
				json.directory AS json,\
				json.cert_user_id AS cert_user_id,\
				issues.id AS issue_id,\
				json.directory AS issue_json\
			FROM issues, json\
			WHERE\
				issues.json_id = json.json_id AND\
				json.directory = :json AND\
				issues.id = :id AND\
				json.site = :address\
			\
			UNION ALL\
			\
			SELECT\
				issue_comments.id AS id,\
				issue_comments.body AS body,\
				issue_comments.date_added AS date_added,\
				json.directory AS json,\
				json.cert_user_id AS cert_user_id,\
				issue_comments.issue_id AS issue_id,\
				issue_comments.issue_json AS issue_json\
			FROM issue_comments, json\
			WHERE\
				issue_comments.json_id = json.json_id AND\
				issue_comments.issue_json = :json AND\
				issue_comments.issue_id = :id AND\
				json.site = :address\
			\
			ORDER BY date_added ASC\
		", {
			json: json,
			id: id,
			address: this.address
		});
	}
	addIssueComment(issueId, issueJson, content) {
		let auth, row;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;

				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
					"issue_comments",
					{
						issue_id: issueId,
						issue_json: issueJson,
						body: content,
						date_added: Date.now()
					},
					{
						source: "next_issue_comment_id",
						column: "id"
					}
				);
			})
			.then(r => {
				row = r;

				return this.zeroDB.getJsonID(this.address + "/data/users/" + auth.address + "/data.json", 3);
			})
			.then(json_id => {
				row.json = "data/users/" + auth.address;

				return this.zeroDB.query("SELECT * FROM json WHERE json_id = :jsonId", {jsonId: json_id});
			})
			.then(jsonRow => {
				row.cert_user_id = jsonRow[0].cert_user_id;

				return row;
			});
	}
	changeIssueStatus(id, json, open) {
		return this.zeroDB.changeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			"issues",
			issue => {
				if(issue.id != id) {
					return issue;
				}

				if(open) {
					issue.open = true;
					issue.reopened = true;
				} else {
					issue.open = false;
				}

				return issue;
			}
		);
	}

	// Pull requests
	addPullRequest(title, content, forkAddress, forkBranch, tags) {
		let auth, row;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;

				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
					"pull_requests",
					{
						title: title,
						body: content,
						date_added: Date.now(),
						merged: 0,
						fork_address: forkAddress,
						fork_branch: forkBranch,
						tags: tags.join(",")
					},
					{
						source: "next_pull_request_id",
						column: "id"
					}
				);
			})
			.then(row => {
				row.json = "data/users/" + auth.address;
				return row;
			});
	}
	getPullRequests(page) {
		return this.zeroDB.query("SELECT pull_requests.*, json.directory as json, json.cert_user_id FROM pull_requests, json WHERE pull_requests.json_id = json.json_id AND json.site = :address LIMIT " + (page * 10) + ", 11", {
			address: this.address
		})
			.then(pullRequests => {
				return {
					pullRequests: pullRequests.slice(0, 10)
						.map(pullRequest => {
							pullRequest.tags = pullRequest.tags ? pullRequest.tags.split(",") : [];
							return pullRequest;
						}),
					nextPage: pullRequests.length > 10
				};
			});
	}
	getPullRequest(id, json) {
		let pullRequest;
		return this.zeroDB.query("SELECT pull_requests.*, json.directory, json.cert_user_id FROM pull_requests, json WHERE pull_requests.json_id = json.json_id AND json.directory = :json AND pull_requests.id = :id AND json.site = :address", {
			json: json,
			id: id,
			address: this.address
		})
			.then(p => {
				pullRequest = p[0];
				pullRequest.tags = pullRequest.tags ? pullRequest.tags.split(",") : [];

				return this.isSignable(pullRequest.directory + "/content.json");
			})
			.then(signable => {
				pullRequest.owned = signable;
				return pullRequest;
			});
	}
	getPullRequestComments(id, json) {
		return this.zeroDB.query("\
			SELECT\
				-1 AS id,\
				pull_requests.body AS body,\
				pull_requests.date_added AS date_added,\
				json.directory AS json,\
				json.cert_user_id AS cert_user_id,\
				pull_requests.id AS pull_request_id,\
				json.directory AS pull_request_json\
			FROM pull_requests, json\
			WHERE\
				pull_requests.json_id = json.json_id AND\
				json.directory = :json AND\
				pull_requests.id = :id AND\
				json.site = :address\
			\
			UNION ALL\
			\
			SELECT\
				pull_request_comments.id AS id,\
				pull_request_comments.body AS body,\
				pull_request_comments.date_added AS date_added,\
				json.directory AS json,\
				json.cert_user_id AS cert_user_id,\
				pull_request_comments.pull_request_id AS pull_request_id,\
				pull_request_comments.pull_request_json AS pull_request_json\
			FROM pull_request_comments, json\
			WHERE\
				pull_request_comments.json_id = json.json_id AND\
				pull_request_comments.pull_request_json = :json AND\
				pull_request_comments.pull_request_id = :id AND\
				json.site = :address\
			\
			ORDER BY date_added ASC\
		", {
			json: json,
			id: id,
			address: this.address
		});
	}
	addPullRequestComment(pullRequestId, pullRequestJson, content) {
		let auth, row;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;

				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
					"pull_request_comments",
					{
						pull_request_id: pullRequestId,
						pull_request_json: pullRequestJson,
						body: content,
						date_added: Date.now()
					},
					{
						source: "next_pull_request_comment_id",
						column: "id"
					}
				);
			})
			.then(r => {
				row = r;

				return this.zeroDB.getJsonID(this.address + "/data/users/" + auth.address + "/data.json", 3);
			})
			.then(json_id => {
				row.json = "data/users/" + auth.address;

				return this.zeroDB.query("SELECT * FROM json WHERE json_id = :jsonId", {jsonId: json_id});
			})
			.then(jsonRow => {
				row.cert_user_id = jsonRow[0].cert_user_id;

				return row;
			});
	}
	changePullRequestStatus(id, json, merged) {
		return this.zeroDB.changeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			"pull_requests",
			pullRequest => {
				if(pullRequest.id != id) {
					return pullRequest;
				}

				pullRequest.merged = merged;

				return pullRequest;
			}
		);
	}
	importPullRequest(pullRequest) {
		let forkAddress = pullRequest.fork_address;
		if(forkAddress.indexOf("1GitLiXB6t5r8vuU2zC6a8GYj9ME6HMQ4t") > -1) {
			// http://127.0.0.1:43110/1GitLiXB6t5r8vuU2zC6a8GYj9ME6HMQ4t/repo/?address
			forkAddress = forkAddress.match(/repo\/\?(.*)/)[1];
		} else {
			// http://127.0.0.1:43110/address
			// or
			// address
			forkAddress = forkAddress.match(/1[A-Za-z0-9]{25,34}/)[0];
		}

		let other = new Repository(forkAddress, this.zeroPage);

		let ref;
		return other.addMerger()
			.then(() => {
				return other.git.getBranchCommit(pullRequest.fork_branch);
			})
			.then(r => {
				ref = r;
				return this.git.importObjectWithDependencies(other.git, ref);
			})
			.then(() => {
				return this.git.setRef("refs/heads/pr-" + pullRequest.id + "-" + pullRequest.cert_user_id.replace(/@.*/, ""), ref);
			});
	}

	// Muted
	getMuted() {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/data/users/content.json")
			.then(content => {
				content = JSON.parse(content);

				return Object.keys(content.user_contents.permissions)
					.filter(username => content.user_contents.permissions[username] == false);
			});
	}
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

	// Maintainers
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

	// Follow
	follow() {
		return this.zeroPage.cmd("feedListFollow")
			.then(feedList => {
				if(!feedList["Issues"]) {
					feedList["Issues"] = [FOLLOW_QUERIES.issues, []];
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

				Object.values(feedList).forEach(feed => feed[1].push(this.address));

				return this.zeroPage.cmd("feedFollow", [feedList]);
			});
	}
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
	updateFollow() {
		return this.zeroPage.cmd("feedListFollow")
			.then(feedList => {
				let changed = false;
				if(feedList["Issues"] && feedList["Issues"][0] != FOLLOW_QUERIES.issues) {
					feedList["Issues"][0] = FOLLOW_QUERIES.issues;
					changed = true;
				}
				if(feedList["Pull requests"] && feedList["Pull requests"][0] != FOLLOW_QUERIES.pullRequests) {
					feedList["Pull requests"][0] = FOLLOW_QUERIES.pullRequests;
					changed = true;
				}
				if(feedList["Issue comments"] && feedList["Issue comments"][0] != FOLLOW_QUERIES.issueComments) {
					feedList["Issue comments"][0] = FOLLOW_QUERIES.issueComments;
					changed = true;
				}
				if(feedList["Pull request comments"] && feedList["Pull request comments"][0] != FOLLOW_QUERIES.pullRequestComments) {
					feedList["Pull request comments"][0] = FOLLOW_QUERIES.pullRequestComments;
					changed = true;
				}
				if(changed) {
					return this.zeroPage.cmd("feedFollow", [feedList]);
				}
			});
	}
	isFollowing() {
		return this.zeroPage.cmd("feedListFollow")
			.then(feedList => {
				return (
					Object.values(feedList).length > 0 &&
					Object.values(feedList).every(feed => feed[1].indexOf(this.address) > -1)
				);
			});
	}

	// Index
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
	getIndexers() {
		return this.zeroDB.query("SELECT repo_index.*, json.cert_user_id FROM repo_index, json WHERE repo_index.json_id = json.json_id AND repo_index.address = :address", {
			address: this.address
		})
			.then(addresses => {
				return addresses.map(address => address.cert_user_id);
			});
	}

	// Starring
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

	translateDate(date) {
		date = new Date(date);

		return (
			date.getFullYear() + "-" +
			(date.getMonth() >= 9 ? "" : "0") + (date.getMonth() + 1) + "-" +
			(date.getDate() >= 10 ? "" : "0") + date.getDate()
		);
	}
	translateTime(date) {
		date = new Date(date);

		return (
			date.getHours() + ":" +
			(date.getMinutes() >= 10 ? "" : "0") + date.getMinutes() + ":" +
			(date.getSeconds() >= 10 ? "" : "0") + date.getSeconds()
		);
	}

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
						if(parent.content.ancestors.indexOf(leaf) > 0) {
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
	parseAuthor(author) {
		let name = author.substr(0, author.indexOf("<")).trim();
		let email = author.substr(0, author.indexOf(">")).substr(author.indexOf("<") + 1);
		let timestamp = author.substr(author.indexOf(">") + 1).trim().split(" ");
		let tz = timestamp[1];
		let offset = (new Date).getTimezoneOffset() * -1;

		let utcDate = (parseInt(timestamp[0]) + (tz.substr(1, 2) * 3600 + tz.substr(3, 2) * 60) * (tz[0] == "+" ? 1 : -1)) * 1000;
		let relativeDate = utcDate - offset * 60000;
		let offsetString = offset == 0 ? "UTC" : "GMT " + (offset < 0 ? "-" : "+") + (Math.abs(offset) / 60) + ":" + (Math.abs(offset) % 60 >= 10 ? "" : "0") + (Math.abs(offset) % 60);

		return name + " commited on " + this.translateDate(relativeDate) + " " + this.translateTime(relativeDate) + " " + offsetString;
	}
	download(name, data) {
		let blob = new Blob([data], {type: "application/octet-stream"});
		let link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

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
