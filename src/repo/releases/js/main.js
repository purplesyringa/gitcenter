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
		showTabs(1);

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

			let description = document.createElement("div");
			description.className = "release-description";
			description.textContent = "Tagged at " + release.dateString + "\n" + release.description;
			node.appendChild(description);

			document.getElementById("releases").appendChild(node);
		});
	});