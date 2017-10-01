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
		pullRequests.pullRequests.forEach(pullRequest => {
			let tr = document.createElement("tr");
			tr.onclick = () => {
				location.href = "view/?" + address + "/" + pullRequest.id + "@" + pullRequest.json_id;
			};

			let title = document.createElement("td");
			title.textContent = pullRequest.title;
			tr.appendChild(title);

			let icon = document.createElement("img");
			icon.src = "../../img/pr-" + (pullRequest.merged ? "merged" : "opened") + ".svg";
			icon.className = "pull-request-icon";
			title.insertBefore(icon, title.firstChild);

			let info = document.createElement("td");
			info.textContent = "Opened on " + repo.translateDate(pullRequest.date_added) + " by " + pullRequest.cert_user_id;
			info.className = "pull-requests-right";
			tr.appendChild(info);

			document.getElementById("pull_requests").appendChild(tr);
		});

		if(currentPage > 0) {
			let button = document.getElementById("navigation_back");
			button.classList.remove("button-disabled");
			button.href = "?" + address + "/" + (currentPage - 1);
		}

		if(pullRequests.nextPage) {
			let button = document.getElementById("navigation_next");
			button.classList.remove("button-disabled");
			button.href = "?" + address + "/" + (currentPage + 1);
		}
	});