zeroFrame = new ZeroFrame();
zeroPage = new ZeroPage(zeroFrame);

let siteInfo, list;
zeroPage.getSiteInfo()
	.then(s => {
		siteInfo = s;
		if(siteInfo.settings.permissions.indexOf("Merger:GitCenter") == -1) {
			return zeroPage.cmd("wrapperPermissionAdd", ["Merger:GitCenter"]);
		}
	})
	.then(() => {
		if(siteInfo.settings.permissions.indexOf("Cors:1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz") == -1) {
			return zeroPage.cmd("corsPermission", ["1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz"]);
		}
	})
	.then(() => {
		return zeroPage.cmd("mergerSiteList");
	})
	.then(l => {
		list = l;
		if(!list["1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6"]) {
			return zeroPage.cmd("mergerSiteAdd", ["1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6"]);
		}
	})
	.then(() => {
		if(!list["1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL"]) {
			return zeroPage.cmd("mergerSiteAdd", ["1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL"]);
		}
	})
	.then(() => {
		let button = document.getElementById("create_repository");
		button.classList.remove("button-disabled");
		button.onclick = () => {
			Repository.createRepo(zeroPage);
		};
	});

window.addEventListener("load", () => {
	setTitle("");
});