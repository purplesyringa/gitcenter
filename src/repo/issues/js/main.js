if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

let currentPage = Number.isSafeInteger(+additional) ? +additional : 0;

function showFollowing(isFollowing) {
	document.getElementById("follow").innerHTML = isFollowing ? "Stop following" : "Follow issues and pull requests in newsfeed";
}

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
		document.getElementById("new_issue").href = "new/?" + address;

		additional = +additional;
		return repo.getIssues(Number.isSafeInteger(additional) ? additional : 0);
	})
	.then(issues => {
		showObjects("issue", "issue", issues);

		if(currentPage > 0) {
			let button = document.getElementById("navigation_back");
			button.classList.remove("button-disabled");
			button.href = "?" + address + "/" + (currentPage - 1);
		}

		if(issues.nextPage) {
			let button = document.getElementById("navigation_next");
			button.classList.remove("button-disabled");
			button.href = "?" + address + "/" + (currentPage + 1);
		}

		return repo.isFollowing();
	})
	.then(isFollowing => {
		let followButton = document.getElementById("follow");
		showFollowing(isFollowing);
		followButton.onclick = () => {
			if(isFollowing) {
				repo.unfollow()
					.then(() => {
						isFollowing = false;
						showFollowing(isFollowing);
					});
			} else {
				repo.follow()
					.then(() => {
						isFollowing = true;
						showFollowing(isFollowing);
					});
			}
		};
	});