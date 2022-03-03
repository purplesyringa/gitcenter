if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

let head;

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		if(!content.installed) {
			location.href = "../../install/?" + address;
		}

		setTitle("View " + path + " - " + content.title);

		showTitle(content.title);
		showHeader(1, content);
		showBranches();
		showPath(true);
		showLinks();
		showTabs(1);

		repo.isSignable()
			.then(signable => {
				if(signable) {
					document.getElementById("edit").style.display = "inline-block";
					document.getElementById("edit").href = "../edit/?" + address + "/" + path.replace(/@/g, "@@") + "@" + branch.replace(/@/g, "@@");
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

		return repo.getFiles(head, "");
	})
	.then(() => {
		// Tree exists
		return repo.getFile(head, path)
			.then(blob => {
				let fileContent = document.getElementById("file_content");

				// Maybe this is a markdown file?
				if(path.endsWith(".md") || path.endsWith(".markdown")) {
					fileContent.classList.add("markdown");
					fileContent.innerHTML = repo.renderMarked(repo.vcs.decodeUTF8(blob));
					return;
				}


				fileContent.textContent = repo.vcs.decodeUTF8(blob);
				hljs.highlightBlock(fileContent);

				let lines = fileContent.innerHTML.split("\n");
				lines = lines.map((line, id) => {
					return "<span class='line' id='line_" + (id + 1) + "'><span class='line-number'>" + (id + 1) + "</span>" + line + "</span>";
				});
				fileContent.innerHTML = lines.join("\n");

				let lineNumbers = Array.from(document.getElementsByClassName("line-number"));
				lineNumbers.forEach(lineNumber => {
					lineNumber.onclick = () => {
						zeroPage.cmd("wrapperReplaceState", [null, "", "#L" + parseInt(lineNumber.innerHTML)]);
						location.hash = "#L" + parseInt(lineNumber.innerHTML);
					};
				});

				document.getElementById("download").onclick = () => {
					repo.download(path.split("/").slice(-1)[0], blob);
				};

				window.onhashchange = () => {
					let hash = location.hash.replace("#", "");
					if(hash[0] == "L" && !isNaN(hash.substr(1))) {
						let line = parseInt(hash.substr(1));
						let node = document.getElementById("line_" + line);
						node.scrollIntoView();

						let selected = Array.from(document.getElementsByClassName("line-selected"));
						selected.forEach(line => {
							line.classList.remove("line-selected");
						});
						node.classList.add("line-selected");
					}
				};
				return zeroPage.cmd("wrapperInnerLoaded");
			}, () => {
				// Blob doesn't exist
				let fileContent = document.getElementById("file_content");
				fileContent.textContent = "File " + path + " does not exist on branch " + head;
			});
	}, () => {
		// Tree doesn't exist
		let fileContent = document.getElementById("file_content");
		fileContent.textContent = "Unknown branch " + head;
	});