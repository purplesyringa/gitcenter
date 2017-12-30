zeroFrame = new ZeroFrame();
zeroPage = new ZeroPage(zeroFrame);
zeroFS = new ZeroFS(zeroPage);
zeroAuth = new ZeroAuth(zeroPage);
zeroDB = new ZeroDB(zeroPage);
zeroID = new ZeroID(zeroPage);

let loadProfile = address => {
	return zeroFS.readFile("data/users/" + address + "/data.json")
		.then(profile => JSON.parse(profile), () => ({}));
};

let user = location.search.replace(/[?&]wrapper_nonce=.*/, "").replace("?", "");

let downloaded;
Repository.getDownloadedRepos(zeroPage)
	.then(d => {
		downloaded = d;

		return loadProfile(user);
	})
	.then(profile => {
		if(profile.commitName) {
			return profile.commitName;
		}

		return zeroID.findUserById(user)
			.then(res => res.name);
	})
	.then(userName => {
		document.getElementById("user_name").textContent = userName;

		return zeroID.findUserById(user)
			.then(res => res.name);
	})
	.then(userCert => {
		document.getElementById("user_cert").textContent = userCert + "@zeroid.bit";

		return zeroDB.query("\
			SELECT\
				repo_index.*,\
				json.cert_user_id,\
				COUNT(repo_stars.address) AS stars\
			FROM\
				repo_index,\
				json\
			\
			LEFT JOIN\
				repo_stars\
			ON\
				repo_stars.address = repo_index.address AND\
				repo_stars.star = 1\
			\
			WHERE\
				repo_index.json_id = json.json_id AND\
				json.directory = :json\
			GROUP BY\
				repo_index.address\
			ORDER BY\
				stars DESC\
		", {
			json: "data/users/" + user
		});
	})
	.then(repos => {
		repos.forEach(repo => {
			let node = document.createElement("a");
			node.className = "repo";
			node.href = "/" + repo.address;

			let stars = document.createElement("div");
			stars.className = "repo-stars";
			stars.innerHTML = repo.stars;
			node.appendChild(stars);

			if(downloaded.indexOf(repo.address) > -1) {
				let downloaded = document.createElement("div");
				downloaded.className = "repo-downloaded";
				node.appendChild(downloaded);
			}

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