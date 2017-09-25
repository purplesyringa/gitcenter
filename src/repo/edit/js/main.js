if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
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
		showHeader(1);
		showBranches();
		showPath(true);
		showLinks();
		showTabs(1);

		document.getElementById("view").href = "../file/?" + address + "/" + path.replace(/@/g, "@@") + "@" + branch.replace(/@/g, "@@");

		return repo.getFiles(branch, "");
	})
	.then(() => {
		// Tree exists
		return repo.getFile(branch, path)
			.then(blob => {
				let fileContent = document.getElementById("file_content");
				fileContent.value = repo.git.arrayToString(blob);

				let saveButton = document.getElementById("save");
				let commitMessage = document.getElementById("commit_message");
				saveButton.onclick = () => {
					if(saveButton.classList.contains("button-disabled")) {
						return;
					}
					if(commitMessage.value == "") {
						return;
					}

					saveButton.classList.add("button-disabled");

					repo.saveFile(path, repo.git.stringToArray(fileContent.value), branch, commitMessage.value)
						.then(commit => {
							saveButton.classList.remove("button-disabled");
							commitMessage.value = "";
						});
				};
			}, () => {
				// Blob doesn't exist
				let fileContent = document.getElementById("file_content");
				fileContent.value = "File " + path + " does not exist on branch " + branch;
				document.getElementById("save").classList.add("button-disabled");
			});
	}, () => {
		// Tree doesn't exist
		let fileContent = document.getElementById("file_content");
		fileContent.textContent = "Unknown branch " + branch;
		document.getElementById("save").classList.add("button-disabled");
	});