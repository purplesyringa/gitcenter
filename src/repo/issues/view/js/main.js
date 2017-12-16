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

		showTags("issue", issue);
		drawObjectStatus("issue", "issue", "issue", "issue", issue.open ? (issue.reopened ? "reopened" : "open") : "closed", issue.open ? "close issue" : "reopen issue");

		return showActions("issue", "issue", id, json);
	})
	.then(() => {
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
							showAction(repo.highlightComment(comment), "issue");
						});
				}

				promise
					.then(() => {
						return repo.changeIssueStatus(id, json, !issue.open);
					})
					.then(action => {
						showAction(action, "issue");

						if(issue.open) {
							issue.open = false;
						} else {
							issue.open = true;
							issue.reopened = true;
						}
						drawObjectStatus("issue", "issue", "issue", "issue", issue.open ? (issue.reopened ? "reopened" : "open") : "closed", issue.open ? "close issue" : "reopen issue");

						contentNode.value = "";
						contentNode.disabled = false;
					});
			};
		}
	});