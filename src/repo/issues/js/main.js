if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

let currentPage, status;

additional = additional.split("/");
if(additional.length == 1) {
	if(Number.isSafeInteger(+additional[0])) {
		currentPage = +additional[0];
		status = "open";
	} else {
		currentPage = 0;
		status = additional[0];
	}
} else {
	currentPage = Number.isSafeInteger(+additional[1]) ? +additional[1] : 0;
	status = additional[0];
}

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
		showHeader(1, content);
		showTabs(1);
		document.getElementById("new_issue").href = "new/?" + address;

		loadObjects("issue", currentPage, status);
	});