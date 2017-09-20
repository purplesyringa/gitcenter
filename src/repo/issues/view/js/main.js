if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../../default/";
}

if(additional.indexOf("@") == -1) {
	location.href = "../?" + address;
}

let id = parseInt(additional.substr(0, additional.indexOf("@")));
let jsonId = parseInt(additional.substr(additional.indexOf("@") + 1));

if(isNaN(id) || isNaN(jsonId)) {
	location.href = "../?" + address;
}

function showComment(comment) {
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

function drawIssueStatus() {
	let statusText = issue.open ? (issue.reopened ? "reopened" : "open") : "closed";

	document.getElementById("issue_status").className = "issue-status issue-status-" + statusText;
	document.getElementById("issue_status_img").src = "../../../img/issue-" + statusText + "-white.svg";
	document.getElementById("issue_status_text").innerHTML = statusText[0].toUpperCase() + statusText.substr(1);

	document.getElementById("comment_submit_close").innerHTML = "Comment and " + (issue.open ? "close" : "reopen") + " issue";
}


let issue;
repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		if(!content.installed) {
			location.href = "../../../install/?" + address;
		}

		showTitle(content.title);
		showTabs(2);

		return repo.getIssue(id, jsonId);
	})
	.then(i => {
		issue = i;

		document.getElementById("issue_title").textContent = issue.title;
		document.getElementById("issue_id").textContent = id;
		document.getElementById("issue_json_id").textContent = jsonId;

		drawIssueStatus();

		return repo.getIssueComments(id, jsonId);
	})
	.then(comments => {
		comments.forEach(showComment);

		document.getElementById("comment_submit").onclick = () => {
			let contentNode = document.getElementById("comment_content");
			if(contentNode.disabled || contentNode.value == "") {
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
				promise = repo.addIssueComment(id, jsonId, contentNode.value)
					.then(comment => {
						showComment(comment);
					});
			}

			promise
				.then(() => {
					return repo.changeIssueStatus(id, jsonId, !issue.open);
				})
				.then(() => {
					if(issue.open) {
						issue.open = false;
					} else {
						issue.open = true;
						issue.reopened = true;
					}
					drawIssueStatus();

					contentNode.value = "";
					contentNode.disabled = false;
				});
		};
	});