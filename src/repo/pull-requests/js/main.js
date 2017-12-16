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

		showTitle(content.title);
		showHeader(1, content.git);
		showTabs(1);
		document.getElementById("new_pull_request").href = "new/?" + address;

		additional = +additional;
		return repo.getPullRequests(Number.isSafeInteger(additional) ? additional : 0);
	})
	.then(pullRequests => {
		showObjects("pull_request", "pull-request", pullRequests);
		showNavigation(pullRequests, currentPage);
		showFollowing();
	});