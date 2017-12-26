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

		setTitle("New issue - " + content.title);

		showTitle(content.title);
		showHeader(2, content);
		showTabs(2);

		document.getElementById("submit").onclick = () => {
			let tags = document.getElementById("tags").value
				.split(",")
				.map(tag => tag.trim())
				.filter(tag => tag.length > 0)
				.filter((tag, i, arr) => arr.indexOf(tag) == i);

			repo.addIssue(document.getElementById("title").value, document.getElementById("content").value, tags)
				.then(issue => {
					location.href = "../view/?" + address + "/" + issue.id + "@" + issue.json.replace("data/users/", "");
				});
		};
	});