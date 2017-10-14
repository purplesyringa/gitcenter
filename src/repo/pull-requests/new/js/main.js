if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../../default/";
}

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

		document.getElementById("submit").onclick = () => {
			repo.addPullRequest(document.getElementById("title").value, document.getElementById("content").value, document.getElementById("fork_address").value, document.getElementById("fork_branch").value)
				.then(pullRequest => {
					location.href = "../view/?" + address + "/" + pullRequest.id + "@" + pullRequest.json.replace("data/users/", "");
				});
		};
	});