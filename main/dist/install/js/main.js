repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		if(content.installed) {
			location.href = "../repo/?" + address;
		}

		let title = document.getElementById("title");
		let description = document.getElementById("description");
		let gitAddress = document.getElementById("address");

		let showGitAddress = () => {
			gitAddress.value = title.value.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
			if(gitAddress.value) {
				if(typeSelect.value == "git") {
					gitAddress.value += ".git";
				} else {
					gitAddress.value += "/.hg";
				}
			} else {
				if(typeSelect.value == "git") {
					gitAddress.value = "repo.git";
				} else {
					gitAddress.value = "repo/.hg";
				}
			}
		};

		title.oninput = () => {
			showGitAddress();
		};

		let installButton = document.getElementById("install");
		installButton.onclick = () => {
			if(installButton.classList.contains("button-disabled")) {
				return;
			} else if(title.value == "" || description.value == "" || gitAddress.value == "") {
				return;
			}

			installButton.classList.add("button-disabled");

			repo.install(title.value, description.value, gitAddress.value, typeSelect.value)
				.then(() => {
					location.href = "../repo/?" + address;
				}, e => {
					zeroPage.error(e);
					installButton.classList.remove("button-disabled");
				});
		};

		let typeSelect = document.getElementById("type");
		typeSelect.onchange = () => {
			showGitAddress();
		};
	});

window.addEventListener("load", () => {
	setTitle("Create new repository");
});