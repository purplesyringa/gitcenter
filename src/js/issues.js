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
		return this.runObject(object, id, json, obj => {
			obj.body = content;
			return obj;
		}, null);
	}
	changeObjectTags(context, id, json, tags) {
		let action = null;

		return this.getObject(context, id, json)
			.then(object => {
				let added = tags.filter(tag => object.tags.indexOf(tag) == -1);
				let removed = object.tags.filter(tag => tags.indexOf(tag) == -1);
				if(added.length && removed.length) {
					action = {
						action: "changeTags",
						param: "added " + added.join(", ") + ", removed " + removed.join(", ")
					};
				} else if(added.length) {
					action = {
						action: "addTags",
						param: added.join(",")
					};
				} else if(removed.length) {
					action = {
						action: "removeTags",
						param: removed.join(",")
					};
				}

				return this.runObject(context, id, json, obj => {
					obj.tags = tags.join(",");
					return obj;
				}, action);
			});
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
	getObjectComments(object, id, json) {
		let comments;

		return this.zeroDB.query("\
			SELECT\
				-1 AS id,\
				{object}s.body AS body,\
				{object}s.date_added AS date_added,\
				json.directory AS json,\
				json.cert_user_id AS cert_user_id,\
				{object}s.id AS {object}_id,\
				json.directory AS {object}_json\
			FROM {object}s, json\
			WHERE\
				{object}s.json_id = json.json_id AND\
				json.directory = :json AND\
				{object}s.id = :id AND\
				json.site = :address\
			\
			UNION ALL\
			\
			SELECT\
				{object}_comments.id AS id,\
				{object}_comments.body AS body,\
				{object}_comments.date_added AS date_added,\
				json.directory AS json,\
				json.cert_user_id AS cert_user_id,\
				{object}_comments.{object}_id AS {object}_id,\
				{object}_comments.{object}_json AS {object}_json\
			FROM {object}_comments, json\
			WHERE\
				{object}_comments.json_id = json.json_id AND\
				{object}_comments.{object}_json = :json AND\
				{object}_comments.{object}_id = :id AND\
				json.site = :address\
			\
			ORDER BY date_added ASC\
		".replace(/{object}/g, object), {
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
	getObjectActions(object, id, json) {
		let comments;
		return this.getObjectComments(object, id, json)
			.then(c => {
				comments = c;

				return this.zeroDB.query("\
					SELECT\
						{object}_actions.id AS id,\
						{object}_actions.action AS action,\
						{object}_actions.param AS param,\
						{object}_actions.date_added AS date_added,\
						json.directory AS json,\
						json.cert_user_id AS cert_user_id,\
						{object}_actions.{object}_id AS {object}_id,\
						{object}_actions.{object}_json AS {object}_json\
					FROM {object}_actions, json\
					WHERE\
						{object}_actions.json_id = json.json_id AND\
						{object}_actions.{object}_json = :json AND\
						{object}_actions.{object}_id = :id AND\
						json.site = :address\
					\
					ORDER BY date_added ASC\
				".replace(/{object}/g, object), {
					json: json,
					id: id,
					address: this.address
				});
			})
			.then(actions => {
				return comments.concat(actions).sort((a, b) => a.date_added - b.date_added);
			});
	}
	addObjectComment(object, objectId, objectJson, content) {
		let auth, row;
		return this.zeroAuth.requestAuth()
			.then(a => {
				auth = a;

				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
					object + "_comments",
					{
						[object + "_id"]: objectId,
						[object + "_json"]: objectJson,
						body: content,
						date_added: Date.now()
					},
					{
						source: "next_" + object + "_comment_id",
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
	changeObjectComment(object, id, json, content) {
		return this.zeroDB.changeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			object + "_comments",
			comment => {
				if(comment.id != id) {
					return comment;
				}

				comment.body = content;

				return comment;
			}
		);
	}
	removeObjectComment(object, id, json) {
		return this.zeroDB.removeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			object + "_comments",
			comment => {
				return comment.id == id;
			}
		);
	}
	runObject(object, id, json, handler, action) {
		return this.zeroDB.changeRow(
			"merged-GitCenter/" + this.address + "/" + json + "/data.json",
			"merged-GitCenter/" + this.address + "/" + json + "/content.json",
			object + "s",
			obj => {
				if(obj.id != id) {
					return obj;
				}

				return handler(obj);
			}
		)
			.then(() => {
				if(action) {
					let auth = this.zeroAuth.getAuth();
					if(!auth) {
						return Promise.reject("RunObject: Cannot add action: logged out");
					}

					return this.zeroDB.insertRow(
						"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
						"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
						object + "_actions",
						{
							[object + "_id"]: id,
							[object + "_json"]: json,
							action: action.action,
							param: action.param,
							date_added: Date.now()
						},
						{
							source: "next_" + object + "_action_id",
							column: "id"
						}
					);
				}
			})
			.then(row => {
				if(row) {
					let auth = this.zeroAuth.getAuth();
					row.cert_user_id = auth ? auth.user : "You";
					return row;
				}
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
		return this.getObjectComments("issue", id, json);
	}
	getIssueActions(id, json) {
		return this.getObjectActions("issue", id, json);
	}
	addIssueComment(issueId, issueJson, content) {
		return this.addObjectComment("issue", issueId, issueJson, content);
	}
	changeIssueComment(id, json, content) {
		return this.changeObjectComment("issue", id, json, content);
	}
	removeIssueComment(id, json) {
		return this.removeObjectComment("issue", id, json);
	}
	changeIssueStatus(id, json, open) {
		return this.runObject("issue", id, json, issue => {
			if(open) {
				issue.open = true;
				issue.reopened = true;
			} else {
				issue.open = false;
			}

			return issue;
		}, {
			action: "changeStatus",
			param: open ? "reopen" : "close"
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
		return this.getObjectComments("pull_request", id, json);
	}
	getPullRequestActions(id, json) {
		return this.getObjectActions("pull_request", id, json);
	}
	addPullRequestComment(pullRequestId, pullRequestJson, content) {
		return this.addObjectComment("pull_request", pullRequestId, pullRequestJson, content);
	}
	changePullRequestComment(id, json, content) {
		return this.changeObjectComment("pull_request", id, json, content);
	}
	removePullRequestComment(id, json) {
		return this.removeObjectComment("pull_request", id, json);
	}
	changePullRequestStatus(id, json, merged) {
		return this.runObject("pull_request", id, json, pullRequest => {
			pullRequest.merged = merged;
			return pullRequest;
		}, {
			action: "changeStatus",
			param: merged ? "close" : "reopen"
		});
	}
	importPullRequest(pullRequest) {
		let forkAddress = pullRequest.fork_address;
		if(
			forkAddress.indexOf("1GitLiXB6t5r8vuU2zC6a8GYj9ME6HMQ4t") > -1 ||
			forkAddress.indexOf("gitcenter.bit") > -1
		) {
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