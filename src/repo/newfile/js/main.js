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
		showHeader(1, content.git);
		showBranches();
		showPath(true);
		showTabs(1);

		document.getElementById("cancel").href = "../?" + address + "/" + path.replace(/@/g, "@@") + "@" + branch.replace(/@/g, "@@");

		let fileContent = document.getElementById("file_content");
		let fileName = document.getElementById("file_name");
		let saveButton = document.getElementById("save");
		let commitMessage = document.getElementById("commit_message");
		saveButton.onclick = () => {
			if(saveButton.classList.contains("button-disabled")) {
				return;
			}
			if(commitMessage.value == "" || fileName.value == "") {
				return;
			}

			saveButton.classList.add("button-disabled");

			repo.saveFile((path ? path + "/" : "") + fileName.value, repo.git.stringToArray(fileContent.value), branch, commitMessage.value)
				.then(commit => {
					location.href = "../edit/?" + address + "/" + ((path ? path + "/" : "") + fileName.value).replace(/@/g, "@@") + "@" + (repo.git.isSha(branch) ? commit : branch).replace(/@/g, "@@");
				});
		};
	});