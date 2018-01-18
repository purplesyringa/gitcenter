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


let pullRequest, content;
repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(c => {
		content = c;

		if(!content.installed) {
			location.href = "../../../install/?" + address;
		}

		setTitle("Pull request - " + content.title);

		showTitle(content.title);
		showHeader(2, content);
		showTabs(2);

		return repo.getPullRequest(id, json);
	})
	.then(i => {
		pullRequest = i;

		document.getElementById("pull_request_title").textContent = pullRequest.title;
		document.getElementById("pull_request_id").textContent = id;
		document.getElementById("pull_request_json_id").textContent = json.replace("data/users/", "");
		document.getElementById("pull_request_fork_address").textContent = pullRequest.fork_address;
		document.getElementById("pull_request_fork_branch").textContent = pullRequest.fork_branch;

		setTitle(pullRequest.title + " - " + content.title);

		showTags("pull_request", pullRequest);
		drawObjectStatus("pull_request", pullRequest.merged ? "merged" : "opened", pullRequest.merged ? "reopen pull request" : "mark pull request as merged");
		showCommentButtons("pull_request", pullRequest, id, json, () => {
			pullRequest.merged = !pullRequest.merged;
			drawObjectStatus("pull_request", pullRequest.merged ? "merged" : "opened", pullRequest.merged ? "reopen pull request" : "mark pull request as merged");

			return repo.issues.changePullRequestStatus(id, json, pullRequest.merged);
		});

		return showActions("pull_request", id, json);
	})
	.then(() => {
		if(pullRequest.owned) {
			let commentImport = document.getElementById("comment_import");
			commentImport.style.display = "inline-block";
			commentImport.title = "Import branch " + pullRequest.fork_address + "/" + pullRequest.fork_branch + " as " + address + "/pr-" + id + "-" + json;
			commentImport.onclick = () => {
				if(commentImport.classList.contains("button-disabled")) {
					return;
				}
				commentImport.classList.add("button-disabled");

				repo.importPullRequest(pullRequest)
					.then(() => {
						zeroPage.alert("Branch pr-" + id + "-" + pullRequest.cert_user_id.replace(/@.*/, "") + " was imported to your repository. Run git fetch to download and merge it.");
						commentImport.classList.remove("button-disabled");
					}, e => {
						zeroPage.error(e);
						commentImport.classList.remove("button-disabled");
					});
			};
		}
	});