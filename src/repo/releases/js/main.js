if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

let isSignable;

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		if(!content.installed) {
			location.href = "../../install/?" + address;
		}

		setTitle("Releases - " + content.title);

		showTitle(content.title);
		showHeader(1, content);
		showTabs(1);

		return repo.isSignable();
	})
	.then(s => {
		isSignable = s;

		return repo.getReleases();
	})
	.then(releases => {
		releases.forEach(release => {
			let node = document.createElement("div");
			node.className = "release";

			let title = document.createElement("a");
			title.className = "release-title";
			title.textContent = release.title;
			title.href = "../?" + address + "/@" + release.tag;
			node.appendChild(title);

			let tag = document.createElement("div");
			tag.className = "release-tag";
			tag.textContent = release.tag;
			node.appendChild(tag);

			if(isSignable) {
				let button = document.createElement("a");
				button.className = "button release-not-release";
				button.innerHTML = "This is not a release";
				button.onclick = () => {
					button.classList.add("button-disabled");

					return repo.removeRelease(release.tag)
						.then(() => {
							location.href = "?" + address;
						});
				};
				node.appendChild(button);
			}

			let description = document.createElement("div");
			description.className = "release-description";
			description.textContent = "Tagged " + release.dateString + "\n" + release.description;
			node.appendChild(description);

			document.getElementById("releases").appendChild(node);
		});
	});