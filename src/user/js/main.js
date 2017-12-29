zeroFrame = new ZeroFrame();
zeroPage = new ZeroPage(zeroFrame);
zeroFS = new ZeroFS(zeroPage);
zeroAuth = new ZeroAuth(zeroPage);
zeroID = new ZeroID(zeroPage);

let loadProfile = address => {
	return zeroFS.readFile("data/users/" + address + "/data.json")
		.then(profile => JSON.parse(profile), () => ({}));
};

let user = location.search.replace(/[?&]wrapper_nonce=.*/, "").replace("?", "");

loadProfile(user)
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
	});