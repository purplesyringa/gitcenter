function drawObjectStatus(context, statusText, statusUpdate) {
	let cssContext = repo.issues.contexts[context].css;
	let imgContext = repo.issues.contexts[context].img;
	let textContext = repo.issues.contexts[context].text;

	document.getElementById(context + "_status").className = cssContext + "-status " + cssContext + "-status-" + statusText;
	document.getElementById(context + "_status_img").src = "../../../img/" + imgContext + "-" + statusText + "-white.svg";
	document.getElementById(context + "_status_text").innerHTML = statusText[0].toUpperCase() + statusText.substr(1);

	document.getElementById("comment_submit_close").innerHTML = "Comment and " + statusUpdate;
}


function addTag(context, object, tag) {
	let color = repo.tagToColor(tag);

	let node = document.createElement("a");
	node.className = "tag";
	node.style.setProperty("background-color", color.background, "important");
	node.style.setProperty("color", color.foreground, "important");
	node.href = "../../filter/?" + address + "/tag:" + tag;
	node.textContent = tag;
	document.getElementById("tags").appendChild(node);

	if(object.owned) {
		let remove = document.createElement("div");
		remove.className = "tag-remove";
		remove.innerHTML = "&times;";
		remove.onclick = e => {
			e.preventDefault();
			e.stopPropagation();

			node.parentNode.removeChild(node);
			object.tags.splice(object.tags.indexOf(tag), 1);

			repo.issues.changeObjectTags(context, id, json, object.tags)
				.then(action => showAction(action, context));
		};
		node.appendChild(remove);
	}
}

function showTags(context, object) {
	object.tags.forEach(tag => addTag(context, object, tag));

	if(object.owned) {
		let add = document.createElement("div");
		add.className = "tag-add";
		add.innerHTML = "+";
		add.onclick = () => {
			zeroPage.prompt("New tags (comma-separated):")
				.then(tags => {
					tags = tags
						.split(",")
						.map(tag => tag.trim())
						.filter(tag => tag);

					tags.forEach(tag => addTag(context, object, tag));
					add.parentNode.appendChild(add); // Move to end of container

					object.tags = object.tags.concat(tags);
					return repo.issues.changeObjectTags(context, id, json, object.tags);
				})
				.then(action => showAction(action, context));
		};
		document.getElementById("tags").appendChild(add);
	}
}

/*********************************** Actions **********************************/
function showAction(action, context) {
	let textContext = repo.issues.contexts[context].text;

	if(action.action) {
		let node = document.createElement("div");
		node.className = "action";
		node.innerHTML = repo.parseAction(action, textContext);

		document.getElementById("comments").appendChild(node);
	} else {
		let comment = action;

		let node = document.createElement("div");
		node.className = "comment" + (json == comment.json ? " comment-owned" : "");

		let header = document.createElement("div");
		header.className = "comment-header";
		header.textContent = comment.cert_user_id + " " + (comment.id == -1 ? "posted " + textContext : "commented") + " " + repo.translateDate(comment.date_added);
		node.appendChild(header);

		if(comment.owned) {
			let textarea = document.createElement("textarea");
			textarea.className = "comment-textarea";
			textarea.style.display = "none";
			node.appendChild(textarea);

			let edit = document.createElement("div");
			edit.className = "comment-edit";
			edit.onclick = () => {
				content.style.display = "none";
				edit.style.display = "none";
				remove.style.display = "none";

				textarea.style.display = "";
				save.style.display = "";
				preview.style.display = "";
				cancel.style.display = "";

				textarea.value = comment.originalBody;
				textarea.focus();
			};
			header.appendChild(edit);

			let remove = document.createElement("div");
			remove.className = "comment-remove";
			remove.onclick = () => {
				zeroPage.confirm("Remove " + textContext + (comment.id == -1 ? "" : " comment") + "?")
					.then(() => {
						node.disabled = true;

						let funcName = {
							"issue": "removeIssue",
							"pull_request": "removePullRequest"
						}[context];

						let parentId = {
							"issue": comment.issue_id,
							"pull_request": comment.pull_request_id
						}[context];

						return repo[funcName + (comment.id == -1 ? "" : "Comment")](comment.id == -1 ? parentId : comment.id, comment.json);
					})
					.then(() => {
						if(comment.id == -1) {
							location.href = "../?" + address;
						} else {
							node.style.display = "none";
						}
					});
			};
			header.appendChild(remove);

			let preview = document.createElement("div");
			preview.className = "comment-preview";
			preview.style.display = "none";
			preview.onclick = () => {
				content.style.display = "";
				content.innerHTML = repo.renderMarked(textarea.value);

				textarea.style.display = "none";
				save.style.display = "none";
				cancel.style.display = "none";

				let old = preview.onclick;
				preview.onclick = () => {
					content.style.display = "none";

					textarea.style.display = "";
					save.style.display = "";
					cancel.style.display = "";

					preview.onclick = old;
				};
			};
			header.appendChild(preview);

			let save = document.createElement("div");
			save.className = "comment-save";
			save.style.display = "none";
			save.onclick = () => {
				textarea.disabled = true;

				let funcName = {
					"issue": "changeIssue",
					"pull_request": "changePullRequest"
				}[context];

				let parentId = {
					"issue": comment.issue_id,
					"pull_request": comment.pull_request_id
				}[context];

				repo[funcName + (comment.id == -1 ? "" : "Comment")](comment.id == -1 ? parentId : comment.id, comment.json, textarea.value)
					.then(() => {
						textarea.disabled = false;
						content.innerHTML = repo.renderMarked(textarea.value);
						comment.originalBody = textarea.value;

						content.style.display = "";
						edit.style.display = "";
						remove.style.display = "";

						textarea.style.display = "none";
						save.style.display = "none";
						preview.style.display = "none";
						cancel.style.display = "none";
					});
			};
			header.appendChild(save);

			let cancel = document.createElement("div");
			cancel.className = "comment-cancel";
			cancel.style.display = "none";
			cancel.onclick = () => {
				zeroPage.confirm("Cancel editing " + textContext + (comment.id == -1 ? "" : " comment") + "?")
					.then(() => {
						content.style.display = "";
						edit.style.display = "";
						remove.style.display = "";

						textarea.style.display = "none";
						save.style.display = "none";
						preview.style.display = "none";
						cancel.style.display = "none";
					});
			};
			header.appendChild(cancel);
		}

		let content = document.createElement("div");
		content.className = "comment-content";
		content.innerHTML = comment.body;
		node.appendChild(content);

		let footer = document.createElement("div");
		footer.className = "comment-footer";
		["thumbs-up", "thumbs-down", "smile", "heart"].forEach(reaction => {
			let obj = comment.reactions.find(obj => obj.reaction == reaction);
			let reactionCount = obj ? obj.count : 0;
			let reactionOwned = obj && obj.owned;

			let node = document.createElement("div");
			node.className = "comment-reaction" + (reactionOwned ? " comment-reaction-owned" : "");
			node.onclick = () => {
				repo.issues.toggleObjectReaction(
					context,
					comment[context + "_id"], comment[context + "_json"],
					comment.id, comment.json,
					reaction, !reactionOwned
				)
					.then(() => {
						reactionOwned = !reactionOwned;
						if(reactionOwned) {
							reactionCount++;
						} else {
							reactionCount--;
						}

						node.classList.toggle("comment-reaction-owned", reactionOwned);
						count.innerHTML = reactionCount;
					});
			};

			let icon = document.createElement("div");
			icon.className = "comment-reaction-icon comment-reaction-icon-" + reaction;
			node.appendChild(icon);

			let count = document.createElement("div");
			count.className = "comment-reaction-count";
			count.innerHTML = reactionCount;
			node.appendChild(count);

			footer.appendChild(node);
		});
		node.appendChild(footer);

		document.getElementById("comments").appendChild(node);
	}
}
function showActions(context, id, json) {
	return repo.issues.getObjectActions(context, id, json)
		.then(actions => {
			actions.forEach(action => showAction(action, context));
		});
}


function showCommentButtons(context, object, id, json, closeHandler) {
	document.getElementById("comment_submit").onclick = () => {
		let contentNode = document.getElementById("comment_content");
		if(contentNode.disabled || contentNode.value == "") {
			return;
		}

		contentNode.disabled = true;

		repo.issues.addObjectComment(context, id, json, contentNode.value)
			.then(comment => {
				showAction(repo.highlightComment(comment), context);

				contentNode.value = "";
				contentNode.disabled = false;
			});
	};

	if(object.owned) {
		document.getElementById("comment_submit_close").style.display = "inline-block";
		document.getElementById("comment_submit_close").onclick = () => {
			let contentNode = document.getElementById("comment_content");
			if(contentNode.disabled) {
				return;
			}

			contentNode.disabled = true;

			let promise;
			if(contentNode.value == "") {
				promise = Promise.resolve();
			} else {
				promise = repo.issues.addObjectComment(context, id, json, contentNode.value)
					.then(comment => {
						showAction(repo.highlightComment(comment), context);
					});
			}

			promise
				.then(() => {
					return closeHandler();
				})
				.then(action => {
					showAction(action, context);

					contentNode.value = "";
					contentNode.disabled = false;
				});
		};
	}
}