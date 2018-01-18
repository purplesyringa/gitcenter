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


let issue, content;
repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(c => {
		content = c;

		if(!content.installed) {
			location.href = "../../../install/?" + address;
		}

		setTitle("Issue - " + content.title);

		showTitle(content.title);
		showHeader(2, content);
		showTabs(2);

		return repo.getIssue(id, json);
	})
	.then(i => {
		issue = i;

		document.getElementById("issue_title").textContent = issue.title;
		document.getElementById("issue_id").textContent = id;
		document.getElementById("issue_json_id").textContent = json.replace("data/users/", "");

		setTitle(issue.title + " - " + content.title);

		showTags("issue", issue);
		drawObjectStatus("issue", issue.open ? (issue.reopened ? "reopened" : "open") : "closed", issue.open ? "close issue" : "reopen issue");
		showCommentButtons("issue", issue, id, json, () => {
			if(issue.open) {
				issue.open = false;
			} else {
				issue.open = true;
				issue.reopened = true;
			}

			drawObjectStatus("issue", issue.open ? (issue.reopened ? "reopened" : "open") : "closed", issue.open ? "close issue" : "reopen issue");

			return repo.issues.changeIssueStatus(id, json, issue.open);
		});

		return showActions("issue", id, json);
	});