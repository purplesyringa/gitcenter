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
		showTabs(1);
		document.getElementById("new_issue").href = "new/?" + address;

		additional = +additional;
		return repo.getIssues(Number.isSafeInteger(additional) ? additional : 0);
	})
	.then(issues => {
		issues.issues.forEach(issue => {
			let tr = document.createElement("tr");
			tr.onclick = () => {
				location.href = "view/?" + address + "/" + issue.id + "@" + issue.json_id;
			};

			let title = document.createElement("td");
			title.textContent = issue.title;
			tr.appendChild(title);

			let icon = document.createElement("img");
			icon.src = "../../img/issue-" + (issue.open ? (issue.reopened ? "reopened" : "open") : "closed") + ".svg";
			icon.className = "issue-icon";
			title.insertBefore(icon, title.firstChild);

			let info = document.createElement("td");
			info.textContent = "Opened on " + repo.translateDate(issue.date_added) + " by " + issue.cert_user_id;
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
	});