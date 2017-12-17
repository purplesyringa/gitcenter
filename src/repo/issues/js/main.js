if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

let currentPage = Number.isSafeInteger(+additional) ? +additional : 0;

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		if(!content.installed) {
			location.href = "../../install/?" + address;
		}

		setTitle("Issues - " + content.title);

		showTitle(content.title);
		showHeader(1, content.git);
		showTabs(1);
		document.getElementById("new_issue").href = "new/?" + address;

		loadObjects("issue", "issue", currentPage);
	});