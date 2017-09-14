repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		showTitle(content.title);
		showTabs(2);

		document.getElementById("submit").onclick = () => {
			repo.addIssue(document.getElementById("title").value, document.getElementById("content").value)
				.then(id => {
					location.href = "../view/?" + address + "/" + id;
				});
		};
	});