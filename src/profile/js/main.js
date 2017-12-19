zeroFrame = new ZeroFrame();
zeroPage = new ZeroPage(zeroFrame);
zeroFS = new ZeroFS(zeroPage);
zeroAuth = new ZeroAuth(zeroPage);

let loadProfile = address => {
	return zeroFS.readFile("data/users/" + address + "/data.json")
		.then(profile => JSON.parse(profile), () => ({}));
};
let saveProfile = (address, profile) => {
	return zeroFS.writeFile("data/users/" + address + "/data.json", JSON.stringify(profile, null, "\t"))
		.then(() => {
			return zeroPage.cmd("siteSign", {inner_path: "data/users/" + address + "/content.json"});
		})
		.then(() => {
			return zeroPage.cmd("sitePublish", {inner_path: "data/users/" + address + "/content.json", sign: false});
		})
		.then(res => {
			if(res != "ok" && res.error != "Port not opened." && res.error != "Content publish failed.") {
				return Promise.reject(res);
			}
		});
};

let auth;
zeroPage.getSiteInfo()
	.then(() => {
		return zeroAuth.requestAuth();
	})
	.then(a => {
		auth = a;

		return loadProfile(auth.address);
	})
	.then(profile => {
		document.getElementById("profile").style.display = "block";

		let commitEmail = document.getElementById("commit_email");
		commitEmail.value = profile.commitEmail || auth.user;

		let commitName = document.getElementById("commit_name");
		commitName.value = profile.commitName || auth.user[0].toUpperCase() + auth.user.substr(1).replace(/@.*/, "");

		let saveButton = document.getElementById("save");
		saveButton.onclick = () => {
			if(saveButton.classList.contains("button-disabled")) {
				return;
			}

			saveButton.classList.add("button-disabled");

			saveProfile(auth.address, {
				commitEmail: commitEmail.value,
				commitName: commitName.value
			})
				.then(() => {
					saveButton.classList.remove("button-disabled");
				}, e => {
					zeroPage.error(e);
					saveButton.classList.remove("button-disabled");
				});
		};
	});

window.addEventListener("load", () => {
	setTitle("Profile");
});