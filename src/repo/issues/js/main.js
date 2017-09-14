repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		showTitle(content.title);
		showTabs(1);
		document.getElementById("new_issue").href = "new/?" + address
	});