// Diverged from Repository

class RepositoryIssues {
	constructor(repo) {
		this.address = repo.address;
		this.zeroPage = repo.zeroPage;
		this.zeroFS = repo.zeroFS;
		this.zeroAuth = repo.zeroAuth;
		this.zeroDB = repo.zeroDB;
		this.repo = repo;

		this.contexts = {
			issue: {
				css: "issue",
				text: "issue",
				img: "issue"
			},
			pull_request: {
				css: "pull-request",
				text: "pull request",
				img: "pr"
			},
			object: {
				css: "object",
				text: "object",
				img: "object"
			}
		};
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
	getObjects(object, page, query) {
		return this.zeroDB.query(("\
			SELECT\
				objects.*,\
				COUNT(comments.id) AS comments\
			FROM (\
				SELECT\
					{object}s.*,\
					json.directory AS json,\
					json.cert_user_id\
				FROM {object}s, json\
				\
				WHERE\
					{object}s.json_id = json.json_id AND\
					json.site = :address AND (" +
						(query || "1 = 1") + "\
					)\
			) AS objects\
			\
			LEFT JOIN\
				(\
					SELECT\
						{object}_comments.*,\
						json.directory AS json\
					FROM\
						{object}_comments, json\
					WHERE\
						json.site = :address AND\
						json.json_id = {object}_comments.json_id\
				) AS comments\
			ON\
				comments.{object}_id = objects.id AND\
				comments.{object}_json = objects.json\
			\
			GROUP BY\
				objects.id,\
				objects.json\
			\
			ORDER BY objects.date_added DESC\
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

		return Promise.resolve()
			.then(() => {
				let auth = this.zeroAuth.getAuth();
				if(auth) {
					return this.zeroDB.getJsonID(this.repo.address + "/data/users/" + auth.address + "/data.json", 3);
				}

				return -1;
			})
			.then(jsonId => {
				return this.zeroDB.query("\
					SELECT\
						comments.*,\
						{object}_reactions.reaction AS reaction,\
						COUNT({object}_reactions.reaction) AS reaction_count,\
						{object}_reactions.json_id = :my_json_id AS reaction_owned\
					FROM (\
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
					) AS comments\
					\
					LEFT JOIN\
						{object}_reactions\
					ON\
						{object}_reactions.comment_id = comments.id AND\
						{object}_reactions.comment_json = comments.json AND\
						{object}_reactions.{object}_id = :id AND\
						{object}_reactions.{object}_json = :json\
					\
					GROUP BY\
						{object}_reactions.reaction,\
						{object}_reactions.json_id = :my_json_id,\
						comments.id,\
						comments.json\
				".replace(/{object}/g, object), {
					json: json,
					id: id,
					address: this.address,
					my_json_id: jsonId
				});
			})
			.then(c => {
				comments = c;
				comments = comments.map(comment => this.repo.highlightComment(comment));

				let savedIds = {};
				comments.forEach(comment => {
					let saved = savedIds[comment.id + "|" + comment.json];

					if(saved) {
						if(comment.reaction) {
							let found = saved.reactions.find(reaction => reaction.reaction == comment.reaction);
							if(found) {
								found.count += comment.reaction_count;
								found.owned = found.owned || !!comment.reaction_owned;
							} else {
								saved.reactions.push({
									reaction: comment.reaction,
									count: comment.reaction_count,
									owned: !!comment.reaction_owned
								});
							}
						}
					} else {
						savedIds[comment.id + "|" + comment.json] = comment;

						if(comment.reaction) {
							comment.reactions = [{
								reaction: comment.reaction,
								count: comment.reaction_count,
								owned: !!comment.reaction_owned
							}];
						} else {
							comment.reactions = [];
						}
					}
				});

				comments = Object.values(savedIds);
				comments.sort((a, b) => a.date_added - b.date_added);

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
	toggleObjectReaction(object, id, json, commentId, commentJson, name, value) {
		return this.zeroAuth.requestAuth()
			.then(auth => {
				if(value) {
					return this.zeroDB.insertRow(
						"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
						"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
						object + "_reactions",
						{
							comment_id: commentId,
							comment_json: commentJson,
							[object + "_id"]: id,
							[object + "_json"]: json,
							reaction: name
						}
					);
				} else {
					return this.zeroDB.removeRow(
						"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
						"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
						object + "_reactions",
						reaction => {
							return (
								reaction.comment_id == commentId &&
								reaction.comment_json == commentJson &&
								reaction[object + "_id"] == id &&
								reaction[object + "_json"] == json &&
								reaction.reaction == name
							);
						}
					);
				}
			});
	}
	getObjectActions(object, id, json) {
		let comments;
		return this.getObjectComments(object, id, json)
			.then(c => {
				comments = c;

				return this.repo.getOwnerAddress()
					.catch(() => "");
			})
			.then(owner => {
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
						json.site = :address AND\
						(json.directory == :json OR json.directory == :owner)\
					\
					ORDER BY date_added ASC\
				".replace(/{object}/g, object), {
					json: json,
					id: id,
					address: this.address,
					owner: "data/users/" + owner
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
				row.reactions = [];

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

	/********************************** Filtering *********************************/
	filterObjects(page, query) {
		let sql = context => {
			let notExistingColumns = {
				issue: ["merged"],
				pull_request: ["open", "reopened"]
			}[context];

			let column = column => {
				return notExistingColumns.indexOf(column) > -1 ? "NULL AS " + column + "," : "{object}s." + column + ",";
			};

			return ("\
				SELECT\
					objects.*,\
					COUNT(comments.id) AS comments\
				FROM (\
					SELECT\
						'{object}' AS context," +
						column("id") +
						column("title") +
						column("body") +
						column("date_added") +
						column("open") +
						column("reopened") +
						column("merged") +
						column("tags") +
						column("json_id") +
						"json.directory AS json,\
						json.cert_user_id\
					FROM {object}s, json\
					WHERE\
						{object}s.json_id = json.json_id AND\
						json.site = :address\
				) AS objects\
				\
				LEFT JOIN\
					(\
						SELECT\
							{object}_comments.*,\
							json.directory AS json\
						FROM\
							{object}_comments, json\
						WHERE\
							json.site = :address AND\
							json.json_id = {object}_comments.json_id\
					) AS comments\
				ON\
					comments.{object}_id = objects.id AND\
					comments.{object}_json = objects.json\
				\
				GROUP BY\
					comments.{object}_id,\
					comments.{object}_json\
			").replace(/{object}/g, context);
		};

		return this.zeroDB.query("\
			SELECT * FROM (" +
				sql("issue") +
				"UNION" +
				sql("pull_request") +
			")\
			WHERE (" + (query || "1 = 1") + ")\
			ORDER BY date_added DESC\
			LIMIT " + (page * 10) + ", 11\
		", {
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
	getIssues(page, status) {
		return this.getObjects("issue", page, "{object}s.open = " + (status == "open" ? 1 : 0));
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
	getPullRequests(page, status) {
		return this.getObjects("pull_request", page, "{object}s.merged = " + (status == "open" ? 0 : 1));
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