let zeroFrame = new ZeroFrame();
let zeroPage = new ZeroPage(zeroFrame);
let zeroDB = new ZeroDB(zeroPage);

zeroDB.query("SELECT repo_index.*, json.cert_user_id FROM repo_index, json WHERE repo_index.json_id = json.json_id")
	.then(index => {
		index.forEach(repo => {
			let node = document.createElement("div");
			node.className = "repo";

			let title = document.createElement("div");
			title.className = "repo-title";
			title.textContent = repo.address;
			node.appendChild(title);

			let address = document.createElement("div");
			address.className = "repo-address";
			address.textContent = repo.address;
			node.appendChild(address);

			document.getElementById("repos").appendChild(node);
		});
	});


/*
<div class="repo">
	<div class="repo-title">Git Center Source</div>
	<div class="repo-address">1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6</div>
</div>
*/