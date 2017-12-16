// Diverged from Repository

class RepositoryIssues {
	constructor(repo) {
		this.address = repo.address;
		this.zeroPage = repo.zeroPage;
		this.zeroFS = repo.zeroFS;
		this.zeroAuth = repo.zeroAuth;
		this.zeroDB = repo.zeroDB;
		this.repo = repo;
	}

	/*********************************** Objects **********************************/

	addObject(object, data) {
		let auth, row;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;

				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
					object + "s",
					data,
					{
						source: "next_" + object + "_id",
						column: "id"
					}
				);
			})
			.then(row => {
				row.json = "data/users/" + auth.address;
				row.owned = true;
				return row;
			});
	}
	changeObject(object, id, json, content) {
		return this.zeroDB.changeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			object + "s",
			object => {
				if(object.id != id) {
					return object;
				}

				object.body = content;

				return object;
			}
		);
	}
	changeObjectTags(object, id, json, tags) {
		return this.zeroDB.changeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			object + "s",
			object => {
				if(object.id != id) {
					return object;
				}

				object.tags = tags.join(",");

				return object;
			}
		);
	}
	removeObject(object, id, json) {
		return this.zeroDB.removeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			object + "s",
			object => {
				return object.id == id;
			}
		);
	}
	getObjects(object, page) {
		return this.zeroDB.query(("\
			SELECT\
				{object}s.*,\
				json.directory as json,\
				json.cert_user_id\
			FROM {object}s, json\
			WHERE\
				{object}s.json_id = json.json_id AND\
				json.site = :address\
			ORDER BY {object}s.date_added DESC\
			LIMIT " + (page * 10) + ", 11\
		").replace(/{object}/g, object), {
			address: this.address
		})
			.then(objects => {
				return {
					objects: objects.slice(0, 10)
						.map(object => {
							object.tags = object.tags ? object.tags.split(",") : [];
							return object;
						}),
					nextPage: objects.length > 10
				};
			});
	}
	getObject(object, id, json) {
		let obj;
		return this.zeroDB.query("\
			SELECT\
				{object}s.*,\
				json.directory,\
				json.cert_user_id\
			FROM {object}s, json\
			WHERE\
				{object}s.json_id = json.json_id AND\
				json.directory = :json AND\
				{object}s.id = :id AND\
				json.site = :address\
		".replace(/{object}/g, object), {
			json: json,
			id: id,
			address: this.address
		})
			.then(i => {
				obj = i[0];
				obj.tags = obj.tags ? obj.tags.split(",") : [];

				return this.repo.isSignable(obj.directory + "/content.json");
			})
			.then(signable => {
				obj.owned = signable;
				return obj;
			});
	}

	/*********************************** Issues ***********************************/
	addIssue(title, content, tags) {
		return this.addObject("issue", {
			title: title,
			body: content,
			date_added: Date.now(),
			open: 1,
			reopened: 0,
			tags: tags.join(",")
		});
	}
	changeIssue(id, json, content) {
		return this.changeObject("issue", id, json, content);
	}
	changeIssueTags(id, json, tags) {
		return this.changeObjectTags("issue", id, json, tags);
	}
	removeIssue(id, json) {
		return this.removeObject("issue", id, json);
	}
	getIssues(page) {
		return this.getObjects("issue", page);
	}
	getIssue(id, json) {
		return this.getObject("issue", id, json);
	}
	getIssueComments(id, json) {
		let comments;

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
		})
			.then(c => {
				comments = c;
				comments = comments.map(comment => this.repo.highlightComment(comment));

				return this.repo.isSignable();
			})
			.then(signable => {
				if(signable) {
					return comments.map(comment => {
						comment.owned = true;
						return comment;
					});
				}

				let auth = this.zeroAuth.getAuth();
				if(auth) {
					return comments.map(comment => {
						if(comment.json == "data/users/" + auth.address) {
							comment.owned = true;
						} else {
							comment.owned = false;
						}
						return comment;
					});
				} else {
					return comments;
				}
			});
	}
	getIssueActions(id, json) {
		let comments;
		return this.getIssueComments(id, json)
			.then(c => {
				comments = c;

				return this.zeroDB.query("\
					SELECT\
						issue_actions.id AS id,\
						issue_actions.action AS action,\
						issue_actions.param AS param,\
						issue_actions.date_added AS date_added,\
						json.directory AS json,\
						json.cert_user_id AS cert_user_id,\
						issue_actions.issue_id AS issue_id,\
						issue_actions.issue_json AS issue_json\
					FROM issue_actions, json\
					WHERE\
						issue_actions.json_id = json.json_id AND\
						issue_actions.issue_json = :json AND\
						issue_actions.issue_id = :id AND\
						json.site = :address\
					\
					ORDER BY date_added ASC\
				", {
					json: json,
					id: id,
					address: this.address
				});
			})
			.then(actions => {
				return comments.concat(actions).sort((a, b) => a.date_added - b.date_added);
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
				row.owned = true;

				return row;
			});
	}
	changeIssueComment(id, json, content) {
		return this.zeroDB.changeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			"issue_comments",
			comment => {
				if(comment.id != id) {
					return comment;
				}

				comment.body = content;

				return comment;
			}
		);
	}
	removeIssueComment(id, json) {
		return this.zeroDB.removeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			"issue_comments",
			comment => {
				return comment.id == id;
			}
		);
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
		)
			.then(() => {
				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/" + json + "/data.json",
					"merged-GitCenter/" + this.address + "/" + json + "/content.json",
					"issue_actions",
					{
						issue_id: id,
						issue_json: json,
						action: "changeStatus",
						param: open ? "reopen" : "close",
						date_added: Date.now()
					},
					{
						source: "next_issue_action_id",
						column: "id"
					}
				);
			})
			.then(row => {
				let auth = this.zeroAuth.getAuth();
				row.cert_user_id = auth ? auth.user : "You";
				return row;
			});
	}

	/******************************** Pull requests *******************************/
	addPullRequest(title, content, forkAddress, forkBranch, tags) {
		return this.addObject("pull_request", {
			title: title,
			body: content,
			date_added: Date.now(),
			merged: 0,
			fork_address: forkAddress,
			fork_branch: forkBranch,
			tags: tags.join(",")
		});
	}
	changePullRequest(id, json, content) {
		return this.changeObject("pull_request", id, json, content);
	}
	changePullRequestTags(id, json, tags) {
		return this.changeObjectTags("pull_request", id, json, tags);
	}
	removePullRequest(id, json) {
		return this.removeObject("pull_request", id, json);
	}
	getPullRequests(page) {
		return this.getObjects("pull_request", page);
	}
	getPullRequest(id, json) {
		return this.getObject("pull_request", id, json);
	}
	getPullRequestComments(id, json) {
		let comments;

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
		})
			.then(c => {
				comments = c;
				comments = comments.map(comment => this.repo.highlightComment(comment));

				return this.repo.isSignable();
			})
			.then(signable => {
				if(signable) {
					return comments.map(comment => {
						comment.owned = true;
						return comment;
					});
				}

				let auth = this.zeroAuth.getAuth();
				if(auth) {
					return comments.map(comment => {
						if(comment.json == "data/users/" + auth.address) {
							comment.owned = true;
						} else {
							comment.owned = false;
						}
						return comment;
					});
				} else {
					return comments;
				}
			});
	}
	getPullRequestActions(id, json) {
		let comments;
		return this.getPullRequestComments(id, json)
			.then(c => {
				comments = c;

				return this.zeroDB.query("\
					SELECT\
						pull_request_actions.id AS id,\
						pull_request_actions.action AS action,\
						pull_request_actions.param AS param,\
						pull_request_actions.date_added AS date_added,\
						json.directory AS json,\
						json.cert_user_id AS cert_user_id,\
						pull_request_actions.pull_request_id AS pull_request_id,\
						pull_request_actions.pull_request_json AS pull_request_json\
					FROM pull_request_actions, json\
					WHERE\
						pull_request_actions.json_id = json.json_id AND\
						pull_request_actions.pull_request_json = :json AND\
						pull_request_actions.pull_request_id = :id AND\
						json.site = :address\
					\
					ORDER BY date_added ASC\
				", {
					json: json,
					id: id,
					address: this.address
				});
			})
			.then(actions => {
				return comments.concat(actions).sort((a, b) => a.date_added - b.date_added);
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
				row.owned = true;

				return row;
			});
	}
	changePullRequestComment(id, json, content) {
		return this.zeroDB.changeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			"pull_request_comments",
			comment => {
				if(comment.id != id) {
					return comment;
				}

				comment.body = content;

				return comment;
			}
		);
	}
	removePullRequestComment(id, json) {
		return this.zeroDB.removeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			"pull_request_comments",
			comment => {
				return comment.id == id;
			}
		);
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
		)
			.then(() => {
				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/" + json + "/data.json",
					"merged-GitCenter/" + this.address + "/" + json + "/content.json",
					"pull_request_actions",
					{
						pull_request_id: id,
						pull_request_json: json,
						action: "changeStatus",
						param: merged ? "close" : "reopen",
						date_added: Date.now()
					},
					{
						source: "next_pull_request_action_id",
						column: "id"
					}
				);
			})
			.then(row => {
				let auth = this.zeroAuth.getAuth();
				row.cert_user_id = auth ? auth.user : "You";
				return row;
			});
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
};