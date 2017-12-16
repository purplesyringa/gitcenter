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