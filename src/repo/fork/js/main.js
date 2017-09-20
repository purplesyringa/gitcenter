if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../new/";
}

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		document.getElementById("title").textContent = content.title;
	});