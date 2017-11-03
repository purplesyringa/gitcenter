FOLLOW_QUERIES = {
	issues: "SELECT 'issue' AS type, issues.date_added AS date_added, issues.title AS title, issues.body AS body, 'repo/issues/view/?' || json.site || '/' || issues.id || '@' || REPLACE(json.directory, 'data/users/', '') AS url FROM issues, json WHERE issues.json_id = json.json_id AND json.site IN (:params)",
	pullRequests: "SELECT 'pull_request' AS type, pull_requests.date_added AS date_added, pull_requests.title AS title, pull_requests.body AS body, 'repo/pull-requests/view/?' || json.site || '/' || pull_requests.id || '@' || REPLACE(json.directory, 'data/users/', '') AS url FROM pull_requests, json WHERE pull_requests.json_id = json.json_id AND json.site IN (:params)",
	issueComments: "SELECT 'comment' AS type, issue_comments.date_added AS date_added, issues.title AS title, issue_comments.body AS body, 'repo/issues/view/?' || json.site || '/' || issues.id || '@' || REPLACE(json.directory, 'data/users/', '') AS url FROM issues, issue_comments, json, json AS json2 WHERE issues.json_id = json.json_id AND issue_comments.issue_id = issues.id AND issue_comments.json_id = json2.json_id AND issue_comments.issue_json = json2.directory AND json.site = json2.site AND json.site IN (:params)",
	pullRequestComments: "SELECT 'comment' AS type, pull_request_comments.date_added AS date_added, pull_requests.title AS title, pull_request_comments.body AS body, 'repo/pull-requests/view/?' || json.site || '/' || pull_requests.id || '@' || REPLACE(json.directory, 'data/users/', '') AS url FROM pull_requests, pull_request_comments, json, json AS json2 WHERE pull_requests.json_id = json.json_id AND pull_request_comments.pull_request_id = pull_requests.id AND pull_request_comments.json_id = json2.json_id AND pull_request_comments.pull_request_json = json2.directory AND json.site = json2.site AND json.site IN (:params)"
};

class Repository {
	constructor(address, zeroPage) {
		this.address = address;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
		this.zeroAuth = new ZeroAuth(zeroPage);
		this.zeroDB = new ZeroDB(zeroPage);
	}

	isSignable() {
		return this.zeroPage.isSignable("merged-GitCenter/" + this.address + "/content.json");
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
				return this.zeroPage.cmd("mergerSiteList");
			})
			.then(l => {
				list = l;
				if(!list[this.address]) {
					return this.zeroPage.cmd("mergerSiteAdd", [this.address]);
				}
			})
			.then(() => {
				if(!list["1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL"]) {
					return this.zeroPage.cmd("mergerSiteAdd", ["1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL"]);
				}
			})
			.then(() => {
				return this.getContent();
			})
			.then(content => {
				if(content.git) {
					this.git = new Git("merged-GitCenter/" + this.address + "/" + content.git, zeroPage);
				} else {
					this.git = null;
				}
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
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/content.json")
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
				return this.zeroFS.readFile("data/users/" + auth.address + "/data.json").catch(() => "{}");
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
	fork() {
		return this.zeroPage.cmd("siteClone", [this.address])
	}

	// Git actions
	getFiles(branch, dir) {
		return this.git.readBranchCommit(branch)
			.then(commit => {
				return this.getTree(commit.content.tree, dir);
			});
	}
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
		return this.git.getRefList()
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

				return this.zeroPage.isSignable("merged-GitCenter/" + this.address + "/" + issue.directory + "/content.json");
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

				return this.zeroPage.isSignable("merged-GitCenter/" + this.address + "/" + pullRequest.directory + "/content.json");
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
		let other = new Repository(pullRequest.fork_address, this.zeroPage);

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