if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../default/";
}

let content, head;

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(c => {
		content = c;

		if(!content.installed) {
			location.href = "../install/?" + address;
		}

		setTitle(content.title);

		showTitle(content.title);
		showHeader(0, content);
		showBranches();
		showPath(false);
		showLinks();
		showTabs(0);

		repo.isSignable()
			.then(signable => {
				if(signable) {
					document.getElementById("new_file").style.display = "inline-block";
					document.getElementById("new_file").href = "newfile/?" + address + "/" + path.replace(/@/g, "@@") + "@" + branch.replace(/@/g, "@@");
				}
			});

		return branch || repo.vcs.getHead();
	})
	.then(h => {
		head = h;
		return repo.vcs.readBranchCommit(head);
	})
	.then(commit => {
		document.getElementById("commit_title").textContent = commit.content.message;

		repo.vcs.getBranchCommit(head)
			.then(c => {
				let diff = document.createElement("a");
				diff.textContent = "[diff]";
				diff.href = "commit/?" + address + "/" + c;
				document.getElementById("commit_description").appendChild(diff);

				document.getElementById("commit_description").appendChild(document.createElement("br"));
				document.getElementById("commit_description").appendChild(document.createTextNode(repo.parseAuthor(commit.content.committer)));
			});

		return repo.getFiles(head, path);
	})
	.then(files => {
		let types = ["submodule", "directory", "file"];

		let table = document.getElementById("files");
		files
			.sort((a, b) => {
				let pos = types.indexOf(a.type) - types.indexOf(b.type);
				if(pos != 0) {
					return pos;
				}

				return a.name.localeCompare(b.name);
			})
			.forEach(file => {
				let tr = document.createElement("tr");
				tr.onclick = () => {
					if(file.type == "unknown") {
						return;
					}

					if(file.type == "submodule") {
						let url = file.submodule.url.match(/(1[A-Za-z0-9]{25,34})/);
						if(url) {
							// Likely Git Center URL
							location.href = "?" + url[1];
						} else if(/^git@.*:.*$/.test(file.submodule.url)) {
							// SSH

							// git@hosting:author/repository.git
							// ->
							// hosting/author/repository

							let match = file.submodule.url.match(/^git@(.*):(.*)\/(.*)$/);
							parent.location.href = "http://" + match[1] + "/" + match[2] + "/" + match[3].replace(/\.git$/, "");
						} else if(/^(.*)@[^:]*$/.test(file.submodule.url)) {
							// SSH

							// author@hosting/repository.git
							// ->
							// hosting/author/repository

							let match = file.submodule.url.match(/^(.*)@(.*)\/(.*)$/);
							parent.location.href = "http://" + match[2] + "/" + match[1] + "/" + match[3].replace(/\.git$/, "");
						} else {
							// HTTP/HTTPS URL
							parent.location.href = file.submodule.url.replace(/\.git$/, "");
						}
					} else {
						location.href = (
							(file.type == "file" ? "file/" : "") +
							"?" + address +
							"/" + ((path ? path + "/" : "") + file.name).replace(/@/g, "@@") +
							"@" + branch.replace(/@/g, "@@")
						);
					}
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

		let readme = files.find(file => file.name.toLowerCase() == "readme" || file.name.toLowerCase() == "readme.md");
		if(readme && readme.type == "file") {
			return repo.getFile(head, (path ? path + "/" : "") + readme.name)
				.then(readme => {
					readme = repo.vcs.decodeUTF8(readme);
					document.getElementById("readme").innerHTML = repo.renderMarked(readme);
				});
		} else {
			let root = path == "/" ? "" : path;
			document.getElementById("readme").innerHTML = repo.renderMarked("# " + content.title + "\n" + content.description, root);
		}
	});
