zeroFrame = new ZeroFrame();
zeroPage = new ZeroPage(zeroFrame);
zeroFS = new ZeroFS(zeroPage);
zeroDB = new ZeroDB(zeroPage);

document.getElementById("create_repository").onclick = () => {
	Repository.createRepo(zeroPage);
};

zeroPage.cmd("mergerSiteList", [true])
	.then(repos => {
		repos = Object.keys(repos)
			.filter(repo => typeof repos[repo].privatekey != "undefined");

		let index = repos.indexOf("1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL");
		if(index > -1) {
			repos.splice(index, 1);
		}

		return Promise.all(
			repos.map(repo => {
				return zeroFS.readFile("merged-GitCenter/" + repo + "/content.json")
					.then(content => {
						content = JSON.parse(content);

						return {
							title: content.title,
							description: content.description,
							address: repo
						};
					});
			})
		);
	})
	.then(repos => {
		repos.forEach(repo => {
			let node = document.createElement("a");
			node.className = "repo";
			node.href = "/" + repo.address;

			let title = document.createElement("div");
			title.className = "repo-title";
			title.textContent = repo.title;
			node.appendChild(title);

			let address = document.createElement("div");
			address.className = "repo-address";
			address.textContent = repo.description;
			address.appendChild(document.createElement("br"));
			address.appendChild(document.createTextNode(repo.address));
			node.appendChild(address);

			document.getElementById("repos").appendChild(node);
		});
	});

window.addEventListener("load", () => {
	setTitle("My Repos");
});