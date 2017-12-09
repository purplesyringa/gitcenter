if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../../default/";
}

if(additional.indexOf("@") == -1) {
	location.href = "../?" + address;
}

let id = parseInt(additional.substr(0, additional.indexOf("@")));
let json = "data/users/" + additional.substr(additional.indexOf("@") + 1);

if(isNaN(id) || json == "data/users/") {
	location.href = "../?" + address;
}

function showComment(comment) {
	let node = document.createElement("div");
	node.className = "comment" + (json == comment.json ? " comment-owned" : "");

	let header = document.createElement("div");
	header.className = "comment-header";
	header.textContent = comment.cert_user_id + " " + (comment.id == -1 ? "posted issue" : "commented") + " " + repo.translateDate(comment.date_added);
	node.appendChild(header);

	let content = document.createElement("div");
	content.className = "comment-content";
	content.innerHTML = comment.body;
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
		showHeader(2, content.git);
		showTabs(2);

		return repo.getIssue(id, json);
	})
	.then(i => {
		issue = i;

		document.getElementById("issue_title").textContent = issue.title;
		document.getElementById("issue_id").textContent = id;
		document.getElementById("issue_json_id").textContent = json.replace("data/users/", "");

		issue.tags.forEach(tag => {
			let color = repo.tagToColor(tag);

			let node = document.createElement("div");
			node.className = "tag";
			node.textContent = tag;
			node.style.backgroundColor = color.background;
			node.style.color = color.foreground;
			document.getElementById("tags").appendChild(node);
		});

		drawIssueStatus();

		return repo.getIssueComments(id, json);
	})
	.then(comments => {
		comments.forEach(showComment);

		document.getElementById("comment_submit").onclick = () => {
			let contentNode = document.getElementById("comment_content");
			if(contentNode.disabled || contentNode.value == "") {
				return;
			}

			contentNode.disabled = true;

			repo.addIssueComment(id, json, contentNode.value)
				.then(comment => {
					showComment(repo.highlightComment(comment));

					contentNode.value = "";
					contentNode.disabled = false;
				});
		};

		if(issue.owned) {
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
					promise = repo.addIssueComment(id, json, contentNode.value)
						.then(comment => {
							showComment(comment);
						});
				}

				promise
					.then(() => {
						return repo.changeIssueStatus(id, json, !issue.open);
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
		}
	});