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