repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		showTitle(content.title);
		showTabs(2);

		document.getElementById("submit").onclick = () => {
			repo.addIssue(document.getElementById("title").value, document.getElementById("content").value)
				.then(issue => {
					location.href = "../view/?" + address + "/" + issue.id + "@" + issue.json_id;
				});
		};
	});