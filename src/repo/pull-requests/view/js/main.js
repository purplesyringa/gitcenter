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

function drawPullRequestStatus() {
	let statusText = pullRequest.merged ? "merged" : "opened";

	document.getElementById("pull_request_status").className = "pull-request-status pull-request-status-" + statusText;
	document.getElementById("pull_request_status_img").src = "../../../img/pr-" + statusText + "-white.svg";
	document.getElementById("pull_request_status_text").innerHTML = statusText[0].toUpperCase() + statusText.substr(1);

	document.getElementById("comment_submit_close").innerHTML = "Comment and " + (pullRequest.merged ? "reopen" : "mark") + " pull request" + (pullRequest.merged ? "" : " as merged");
}


let pullRequest;
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

		return repo.getPullRequest(id, jsonId);
	})
	.then(i => {
		pullRequest = i;

		document.getElementById("pull_request_title").textContent = pullRequest.title;
		document.getElementById("pull_request_id").textContent = id;
		document.getElementById("pull_request_json_id").textContent = jsonId;
		document.getElementById("pull_request_fork_address").textContent = pullRequest.fork_address;
		document.getElementById("pull_request_fork_branch").textContent = pullRequest.fork_branch;

		drawPullRequestStatus();

		return repo.getPullRequestComments(id, jsonId);
	})
	.then(comments => {
		comments.forEach(showComment);

		document.getElementById("comment_submit").onclick = () => {
			let contentNode = document.getElementById("comment_content");
			if(contentNode.disabled || contentNode.value == "") {
				return;
			}

			contentNode.disabled = true;

			repo.addPullRequestComment(id, jsonId, contentNode.value)
				.then(comment => {
					showComment(comment);

					contentNode.value = "";
					contentNode.disabled = false;
				});
		};

		if(pullRequest.owned) {
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
					promise = repo.addPullRequestComment(id, jsonId, contentNode.value)
						.then(comment => {
							showComment(comment);
						});
				}

				promise
					.then(() => {
						return repo.changePullRequestStatus(id, jsonId, !pullRequest.open);
					})
					.then(() => {
						pullRequest.merged = !pullRequest.merged;
						drawPullRequestStatus();

						contentNode.value = "";
						contentNode.disabled = false;
					});
			};
		}
	});