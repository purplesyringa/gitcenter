function drawObjectStatus(context, cssContext, imgContext, textContext, statusText, statusUpdate) {
	document.getElementById(context + "_status").className = cssContext + "-status " + cssContext + "-status-" + statusText;
	document.getElementById(context + "_status_img").src = "../../../img/" + imgContext + "-" + statusText + "-white.svg";
	document.getElementById(context + "_status_text").innerHTML = statusText[0].toUpperCase() + statusText.substr(1);

	document.getElementById("comment_submit_close").innerHTML = "Comment and " + statusUpdate;
}


function addTag(context, object, tag) {
	let color = repo.tagToColor(tag);

	let node = document.createElement("div");
	node.className = "tag";
	node.style.backgroundColor = color.background;
	node.style.color = color.foreground;
	node.textContent = tag;
	document.getElementById("tags").appendChild(node);

	if(object.owned) {
		let remove = document.createElement("div");
		remove.className = "tag-remove";
		remove.innerHTML = "&times;";
		remove.onclick = () => {
			node.parentNode.removeChild(node);
			object.tags.splice(object.tags.indexOf(tag), 1);

			repo.issues.changeObjectTags(context, id, json, object.tags);
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
					repo.changeObjectTags(context, id, json, object.tags);
				});
		};
		document.getElementById("tags").appendChild(add);
	}
}

/*********************************** Actions **********************************/
function showAction(action, context) {
	if(action.action) {
		let node = document.createElement("div");
		node.className = "action";
		node.innerHTML = repo.parseAction(action, context);

		document.getElementById("comments").appendChild(node);
	} else {
		let comment = action;

		let node = document.createElement("div");
		node.className = "comment" + (json == comment.json ? " comment-owned" : "");

		let header = document.createElement("div");
		header.className = "comment-header";
		header.textContent = comment.cert_user_id + " " + (comment.id == -1 ? "posted " + context : "commented") + " " + repo.translateDate(comment.date_added);
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

				textarea.value = comment.originalBody;
				textarea.focus();
			};
			header.appendChild(edit);

			let remove = document.createElement("div");
			remove.className = "comment-remove";
			remove.onclick = () => {
				zeroPage.confirm("Remove " + context + (comment.id == -1 ? "" : " comment") + "?")
					.then(() => {
						node.disabled = true;

						let funcName = {
							"issue": "removeIssue",
							"pull request": "removePullRequest"
						}[context];

						let parentId = {
							"issue": comment.issue_id,
							"pull request": comment.pull_request_id
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

			let save = document.createElement("div");
			save.className = "comment-save";
			save.style.display = "none";
			save.onclick = () => {
				textarea.disabled = true;

				let funcName = {
					"issue": "changeIssue",
					"pull request": "changePullRequest"
				}[context];

				let parentId = {
					"issue": comment.issue_id,
					"pull request": comment.pull_request_id
				}[context];

				repo[funcName + (comment.id == -1 ? "" : "Comment")](comment.id == -1 ? parentId : comment.id, comment.json, textarea.value)
					.then(() => {
						textarea.disabled = false;
						content.innerHTML = repo.renderMarked(textarea.value);

						content.style.display = "";
						edit.style.display = "";
						remove.style.display = "";

						textarea.style.display = "none";
						save.style.display = "none";
					});
			};
			header.appendChild(save);
		}

		let content = document.createElement("div");
		content.className = "comment-content";
		content.innerHTML = comment.body;
		node.appendChild(content);

		document.getElementById("comments").appendChild(node);
	}
}
function showActions(context, textContext, id, json) {
	return repo.issues.getObjectActions(context, id, json)
		.then(actions => {
			actions.forEach(action => showAction(action, textContext));

			document.getElementById("comment_submit").onclick = () => {
				let contentNode = document.getElementById("comment_content");
				if(contentNode.disabled || contentNode.value == "") {
					return;
				}

				contentNode.disabled = true;

				repo.issues.addObjectComment(context, id, json, contentNode.value)
					.then(comment => {
						showAction(repo.highlightComment(comment), textContext);

						contentNode.value = "";
						contentNode.disabled = false;
					});
			};
		});
}