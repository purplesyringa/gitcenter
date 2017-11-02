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

		showTitle(content.title);
		showHeader(1, content.git);
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

		return branch || repo.git.getHead();
	})
	.then(h => {
		head = h;
		return repo.git.readBranchCommit(head);
	})
	.then(commit => {
		document.getElementById("commit_title").textContent = commit.content.message;
		document.getElementById("commit_description").appendChild(document.createTextNode(repo.parseAuthor(commit.content.committer)));

		return repo.getFiles(head, "");
	})
	.then(() => {
		// Tree exists
		return repo.getFile(branch, path)
			.then(blob => {
				if(/[\x00-\x09\x0E-\x1F]/.test(repo.git.arrayToString(blob))) { // Binary
					let fileContent = document.getElementById("file_content");
					fileContent.textContent = "This file is binary";
				} else {
					let fileContent = document.getElementById("file_content");
					fileContent.textContent = repo.git.arrayToString(blob);
					hljs.highlightBlock(fileContent);
				}

				document.getElementById("download").onclick = () => {
					repo.download(path.split("/").slice(-1)[0], blob);
				};
			}, () => {
				// Blob doesn't exist
				let fileContent = document.getElementById("file_content");
				fileContent.textContent = "File " + path + " does not exist on branch " + branch;
			});
	}, () => {
		// Tree doesn't exist
		let fileContent = document.getElementById("file_content");
		fileContent.textContent = "Unknown branch " + branch;
	});