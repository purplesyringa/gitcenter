function showLinks() {
	if(repo.git.isSha(branch)) {
		document.getElementById("permanent_link").style.display = "none";
	} else {
		repo.git.getBranchCommit(branch)
			.then(commit => {
				document.getElementById("permanent_link").href = "?" + address + "/" + path.replace(/@/g, "@@") + "@" + commit;
			});
	}
}

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		showTitle(content.title);
		showBranches();
		showPath(false);
		showLinks();

		return repo.getFiles("master", path);
	})
	.then(files => {
		let table = document.getElementById("files");
		files
			.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
			.forEach(file => {
				let tr = document.createElement("tr");
				tr.onclick = () => {
					if(file.type == "unknown") {
						return;
					}

					location.href = (
						(file.type == "file" ? "file/" : "") +
						"?" + address +
						"/" + ((path ? path + "/" : "") + file.name).replace(/@/g, "@@") +
						"@" + branch.replace(/@/g, "@@")
					);
				};

				let name = document.createElement("td");
				name.textContent = file.name;
				tr.appendChild(name);

				let icon = document.createElement("img");
				icon.className = "file-icon";
				icon.src = "../img/" + file.type + ".svg";
				name.insertBefore(icon, name.firstChild);

				table.appendChild(tr);
			});

		let filesBack = document.getElementById("files_back");
		if(path == "" || path == "/") {
			filesBack.style.display = "none";
		} else {
			filesBack.onclick = () => {
				let parts = path.split("/").filter(part => part.length);
				parts.pop();
				location.href = "?" + address + "/" + parts.join("/").replace(/@/g, "@@") + "@" + branch.replace(/@/g, "@@");
			};
		}
	});