zeroFrame = new ZeroFrame();
zeroPage = new ZeroPage(zeroFrame);
zeroDB = new ZeroDB(zeroPage);

zeroDB.query("\
	SELECT repo_index.*, json.cert_user_id, COUNT(repo_stars.address) AS stars\
	FROM repo_index, json\
	LEFT JOIN repo_stars ON repo_stars.address = repo_index.address\
	\
	WHERE repo_index.json_id = json.json_id\
	GROUP BY repo_index.address\
	ORDER BY stars DESC\
")
	.then(index => {
		index.forEach(repo => {
			let node = document.createElement("a");
			node.className = "repo";
			node.href = "/" + repo.address;

			let title = document.createElement("div");
			title.className = "repo-title";
			title.textContent = repo.title;
			node.appendChild(title);

			let stars = document.createElement("div");
			stars.className = "repo-stars";
			stars.textContent = repo.stars;
			node.appendChild(stars);

			let address = document.createElement("div");
			address.className = "repo-address";
			address.textContent = repo.description;
			address.appendChild(document.createElement("br"));
			address.appendChild(document.createTextNode(repo.address));
			node.appendChild(address);

			document.getElementById("repos").appendChild(node);
		});
	});