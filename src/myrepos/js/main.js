let zeroFrame = new ZeroFrame();
let zeroPage = new ZeroPage(zeroFrame);
let zeroFS = new ZeroFS(zeroPage);
let zeroDB = new ZeroDB(zeroPage);

zeroPage.cmd("mergerSiteList")
	.then(repos => {
		repos = Object.keys(repos);

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
							description: content.title + " (" + content.description + ")",
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
			title.textContent = repo.description;
			node.appendChild(title);

			let address = document.createElement("div");
			address.className = "repo-address";
			address.textContent = repo.address;
			node.appendChild(address);

			document.getElementById("repos").appendChild(node);
		});
	});