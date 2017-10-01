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

		let installButton = document.getElementById("install");
		installButton.onclick = () => {
			if(installButton.classList.contains("button-disabled")) {
				return;
			} else if(title.value == "" || description.value == "" || gitAddress == "") {
				return;
			}

			installButton.classList.add("button-disabled");

			repo.install(title.value, description.value, gitAddress.value)
				.then(() => {
					location.href = "../repo/?" + address;
				}, e => {
					zeroPage.error(e);
					installButton.classList.remove("button-disabled");
				});
		};
	});