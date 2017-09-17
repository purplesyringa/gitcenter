if(additional.indexOf("@") == -1) {
	location.href = "../?" + address;
}

let id = parseInt(additional.substr(0, additional.indexOf("@")));
let jsonId = parseInt(additional.substr(additional.indexOf("@") + 1));

if(isNaN(id) || isNaN(jsonId)) {
	location.href = "../?" + address;
}

function showComment(comment) {
	console.log(comment);
	let node = document.createElement("div");
	node.className = "comment" + (jsonId == comment.json_id ? " comment-owned" : "");

	let header = document.createElement("div");
	header.className = "comment-header";
	header.textContent = comment.cert_user_id + " commented on " + repo.translateDate(comment.date_added);
	node.appendChild(header);

	let content = document.createElement("div");
	content.className = "comment-content";
	content.textContent = comment.body;
	node.appendChild(content);

	document.getElementById("comments").appendChild(node);
}


repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		showTitle(content.title);
		showTabs(2);

		return repo.getIssue(id, jsonId);
	})
	.then(issue => {
		document.getElementById("issue_title").textContent = issue.title;
		document.getElementById("issue_id").textContent = id;
		document.getElementById("issue_json_id").textContent = jsonId;

		return repo.getIssueComments(id, jsonId);
	})
	.then(comments => {
		comments.forEach(showComment);

		document.getElementById("comment_submit").onclick = () => {
			let contentNode = document.getElementById("comment_content");
			if(contentNode.disabled) {
				return;
			}

			contentNode.disabled = true;

			repo.addIssueComment(id, jsonId, contentNode.value)
				.then(comment => {
					showComment(comment);

					contentNode.value = "";
					contentNode.disabled = false;
				});
		};
	});