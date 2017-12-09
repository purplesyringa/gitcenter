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
		issues.issues.forEach(issue => {
			let tr = document.createElement("tr");
			tr.onclick = () => {
				location.href = "view/?" + address + "/" + issue.id + "@" + issue.json.replace("data/users/", "");
			};

			let content = document.createElement("td");

			let icon = document.createElement("div");
			icon.className = "issue-icon issue-status-" + (issue.open ? (issue.reopened ? "reopened" : "open") : "closed");
			content.appendChild(icon);

			let title = document.createElement("div");
			title.className = "issue-title";
			title.textContent = issue.title;
			content.appendChild(title);

			let tags = document.createElement("div");
			tags.className = "tags";
			issue.tags.forEach(tag => {
				let color = repo.tagToColor(tag);

				let node = document.createElement("div");
				node.className = "tag";
				node.textContent = tag;
				node.style.backgroundColor = color.background;
				node.style.color = color.foreground;
				tags.appendChild(node);
			});
			content.appendChild(tags);

			tr.appendChild(content);

			let info = document.createElement("td");
			info.textContent = "Opened " + repo.translateDate(issue.date_added) + " by " + issue.cert_user_id;
			info.className = "issues-right";
			tr.appendChild(info);

			document.getElementById("issues").appendChild(tr);
		});

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