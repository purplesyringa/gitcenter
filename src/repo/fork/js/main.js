repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		document.getElementById("title").textContent = content.title;
	});