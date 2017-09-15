repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		showTitle(content.title);
		showTabs(1);
		document.getElementById("new_issue").href = "new/?" + address;

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
			icon.src = "../../img/issue-" + (issue.open ? "opened" : "closed") + ".svg";
			icon.className = "issue-icon";
			title.insertBefore(icon, title.firstChild);

			let info = document.createElement("td");
			info.textContent = "Opened on " + repo.translateDate(issue.date_added) + " by " + issue.cert_user_id;
			info.className = "issues-right";
			tr.appendChild(info);

			document.getElementById("issues").appendChild(tr);
		});
	});