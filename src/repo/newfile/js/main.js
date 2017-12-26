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

		setTitle("New file - " + content.title);

		showTitle(content.title);
		showHeader(1, content);
		showBranches();
		showPath(true, true);
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

			repo.saveFile((path ? path + "/" : "") + fileName.value, repo.vcs.encodeUTF8(fileContent.value), branch, commitMessage.value)
				.then(commit => {
					location.href = "../?" + address + "/" + path.replace(/@/g, "@@") + "@" + (repo.vcs.isSha(branch) ? commit : branch).replace(/@/g, "@@");
				});
		};

		let uploadButton = document.getElementById("upload");
		uploadButton.onclick = () => {
			if(commitMessage.value == "" || fileName.value == "") {
				zeroPage.alert("Please fill commit message and file name in");
				return;
			}

			repo.uploadFile((path ? path + "/" : "") + fileName.value, branch, commitMessage.value)
				.then(commit => {
					location.href = "../?" + address + "/" + path.replace(/@/g, "@@") + "@" + (repo.vcs.isSha(branch) ? commit : branch).replace(/@/g, "@@");
				});
		};
	});