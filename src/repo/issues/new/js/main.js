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
			repo.addIssue(document.getElementById("title").value, document.getElementById("content").value)
				.then(issue => {
					location.href = "../view/?" + address + "/" + issue.id + "@" + issue.json_id;
				});
		};
	});