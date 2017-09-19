class Repository {
	constructor(address, zeroPage) {
		this.address = address;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
		this.zeroAuth = new ZeroAuth(zeroPage);
		this.zeroDB = new ZeroDB(zeroPage);

		this.git = new Git("merged-GitCenter/" + address + "/repo.git", zeroPage);
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
			});
	}

	// Content actions
	getContent() {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/content.json")
			.then(content => JSON.parse(content));
	}
	setContent(content) {
		return this.zeroFS.writeFile("merged-GitCenter/" + this.address + "/content.json", JSON.stringify(content, null, "\t"));
	}
	signContent(signStyle) {
		return this.zeroPage.cmd("sitePublish", {inner_path: "merged-GitCenter/" + this.address + "/content.json", privatekey: signStyle == "site" ? "stored" : null})
			.then(res => {
				if(res != "ok" && res.error != "Port not opened.") {
					return Promise.reject(res);
				}
			});
	}
	sign() {
		return this.zeroPage.cmd("siteSign")
			.cmd(res => {
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

	// Git actions
	getFiles(branch, dir) {
		return this.git.readBranchCommit(branch)
			.then(commit => {
				return this.getTree(commit.content.tree, dir);
			});
	}
	getTree(tree, dir) {
		return this.git.readTreeItem(tree, dir)
			.then(tree => {
				if(tree.type != "tree") {
					return Promise.reject("Commit tree must be a tree");
				}

				return Promise.all(
					tree.content.map(file => {
						return this.git.readUnknownObject(file.id)
							.then(object => {
								if(object.type == "blob") {
									file.type = "file";
								} else if(object.type == "tree") {
									file.type = "directory";
								} else {
									file.type = "unknown";
								}

								return file;
							})
							.catch(object => {
								file.type = "error";
								return file;
							});
					})
				);
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
					.filter(ref => ref.indexOf("refs/heads/") == 0)
					.map(ref => ref.replace("refs/heads/", ""));
			});
	}

	// Issues
	addIssue(title, content) {
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
						reopened: 0
					},
					{
						source: "next_issue_id",
						column: "id"
					}
				);
			})
			.then(r => {
				row = r;

				return this.zeroDB.getJsonID(this.address + "/data/users/" + auth.address + "/data.json", 3);
			})
			.then(json_id => {
				row.json_id = json_id;
				return row;
			});
	}
	getIssues(page) {
		return this.zeroDB.query("SELECT issues.*, json.cert_user_id FROM issues, json WHERE issues.json_id = json.json_id AND json.site = :address LIMIT " + (page * 10) + ", 11", {
			address: this.address
		})
			.then(issues => {
				return {
					issues: issues.slice(0, 10),
					nextPage: issues.length > 10
				};
			});
	}
	getIssue(id, jsonId) {
		return this.zeroDB.query("SELECT issues.*, json.cert_user_id FROM issues, json WHERE issues.json_id = json.json_id AND issues.json_id = :jsonId AND issues.id = :id AND json.site = :address", {
			jsonId: jsonId,
			id: id,
			address: this.address
		})
			.then(issue => {
				return issue[0];
			});
	}
	getIssueComments(id, jsonId) {
		return this.zeroDB.query("\
			SELECT\
				-1 AS id,\
				issues.body AS body,\
				issues.date_added AS date_added,\
				issues.json_id AS json_id,\
				json.cert_user_id AS cert_user_id,\
				issues.id AS issue_id,\
				issues.json_id AS issue_json_id\
			FROM issues, json\
			WHERE\
				issues.json_id = json.json_id AND\
				issues.json_id = :jsonId AND\
				issues.id = :id AND\
				json.site = :address\
			\
			UNION ALL\
			\
			SELECT\
				issue_comments.id AS id,\
				issue_comments.body AS body,\
				issue_comments.date_added AS date_added,\
				issue_comments.json_id AS json_id,\
				json.cert_user_id AS cert_user_id,\
				issue_comments.issue_id AS issue_id,\
				issue_comments.issue_json_id AS issue_json_id\
			FROM issue_comments, json\
			WHERE\
				issue_comments.json_id = json.json_id AND\
				issue_comments.json_id = :jsonId AND\
				issue_comments.issue_id = :id AND\
				json.site = :address\
			\
			ORDER BY date_added ASC\
		", {
			jsonId: jsonId,
			id: id,
			address: this.address
		});
	}
	addIssueComment(issueId, issueJsonId, content) {
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
						issue_json_id: issueJsonId,
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
				row.json_id = json_id;

				return this.zeroDB.query("SELECT * FROM json WHERE json_id = :jsonId", {jsonId: json_id});
			})
			.then(jsonRow => {
				row.cert_user_id = jsonRow[0].cert_user_id;

				return row;
			});
	}
	changeIssueStatus(id, jsonId, open) {
		return this.zeroAuth.requestAuth()
			.then(auth => {
				return this.zeroDB.changeRow(
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
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
			});
	}

	// Maintainers
	getUsers() {
		let users;

		return this.zeroFS.readFile("cors-1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz/data/users.json")
			.then(u => {
				users = JSON.parse(u).users;

				return this.zeroFS.readFile("cors-1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz/data/users_archive.json");
			})
			.then(archived => {
				archived = JSON.parse(archived).users;
				users = Object.assign(users, archived);

				Object.keys(users).forEach(name => {
					let data = users[name].split(",");
					users[name] = {
						type: data[0],
						id: data[1],
						hash: data[2]
					};
				});

				return users;
			});
	}
	getMaintainers() {
		let signers;

		return this.getContent()
			.then(content => {
				signers = content.signers || [];

				return this.getUsers();
			})
			.then(users => {
				let userNames = Object.keys(users);
				signers = signers
					.map(id => {
						let name = userNames.find(name => users[name].id == id);
						if(!name) {
							return false;
						}

						return Object.assign({
							name: name
						}, users[name]);
					})
					.filter(signer => signer);

				return signers;
			});
	}
	removeMaintainer(name) {
		let content, signers;

		return this.getContent()
			.then(c => {
				content = c;
				signers = content.signers || [];

				return this.getUsers();
			})
			.then(users => {
				if(!users[name]) {
					return;
				}

				let index = signers.indexOf(users[name].id);
				if(index == -1) {
					return;
				}

				signers.splice(index, 1);
				content.signers = signers;

				return this.setContent(content);
			})
			.then(() => {
				return this.signContent();
			});
	}
	addMaintainer(name, signStyle) {
		let content, signers;

		return this.getContent()
			.then(c => {
				content = c;
				signers = content.signers || [];

				return this.getUsers();
			})
			.then(users => {
				if(!users[name]) {
					return;
				}

				signers.push(users[name].id);
				content.signers = signers;

				return this.setContent(content);
			})
			.then(() => {
				return this.signContent(signStyle);
			});
	}

	// Index
	addToIndex() {
		let auth;
		return this.zeroAuth.requestAuth()
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

				data.repo_index[this.address] = {};

				data = JSON.stringify(data, null, "\t");

				return this.zeroFS.writeFile("merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/data.json", data);
			})
			.then(() => {
				return this.zeroPage.cmd("sitePublish", {inner_path: "merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/content.json"})
					.then(res => {
						if(res != "ok" && res.error != "Port not opened.") {
							return Promise.reject(res);
						}
					});
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
				return this.zeroPage.cmd("sitePublish", {inner_path: "merged-GitCenter/1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL/data/users/" + auth.address + "/content.json"})
					.then(res => {
						if(res != "ok" && res.error != "Port not opened.") {
							return Promise.reject(res);
						}
					});
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
		// 0 - not indexed
		// 1 - indexed
		// 2 - indexed by current user
		return this.zeroDB.query("SELECT repo_index.*, json.cert_user_id FROM repo_index, json WHERE repo_index.json_id = json.json_id AND repo_index.address = :address", {
			address: this.address
		})
			.then(addresses => {
				let auth = this.zeroAuth.getAuth();
				return (auth && addresses.length == 1 && addresses[0].cert_user_id == auth.user) ? 2 : addresses.length > 0 ? 1 : 0;
			});
	}

	translateDate(date) {
		date = new Date(date);

		return (
			date.getFullYear() + "-" +
			(date.getMonth() >= 9 ? "" : "0") + (date.getMonth() + 1) + "-" +
			date.getDate()
		);
	}
};