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
		return this.zeroPage.cmd("mergerSiteList")
			.then(list => {
				if(!list[this.address]) {
					return this.zeroPage.cmd("mergerSiteAdd", [this.address]);
				}
			});
	}

	// Content actions
	getContent() {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/content.json")
			.then(content => JSON.parse(content));
	}
	setContent(content) {
		return this.zeroFS.writeFile("merged-GitCenter/" + this.address + "/content.json", JSON.stringify(content));
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
		return this.zeroDB.query("SELECT issues.*, json.cert_user_id FROM issues, json WHERE issues.json_id = json.json_id LIMIT " + (page * 10) + ", 11")
			.then(issues => {
				return {
					issues: issues.slice(0, 10),
					nextPage: issues.length > 10
				};
			});
	}
	getIssue(id, jsonId) {
		return this.zeroDB.query("SELECT issues.*, json.cert_user_id FROM issues, json WHERE issues.json_id == json.json_id AND issues.json_id == :jsonId AND issues.id == :id", {
			jsonId: jsonId,
			id: id
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
				issues.json_id = :jsonId\
				AND issues.id = :id\
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
				issue_comments.issue_id = :id\
			\
			ORDER BY date_added ASC\
		", {
			jsonId: jsonId,
			id: id
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

	translateDate(date) {
		date = new Date(date);

		return (
			date.getFullYear() + "-" +
			(date.getMonth() >= 9 ? "" : "0") + (date.getMonth() + 1) + "-" +
			date.getDate()
		);
	}
};