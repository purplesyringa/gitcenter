let zeroFrame = new ZeroFrame();
let zeroPage = new ZeroPage(zeroFrame);

zeroPage.getSiteInfo()
	.then(siteInfo => {
		if(siteInfo.settings.permissions.indexOf("Merger:GitCenter") == -1) {
			return zeroPage.cmd("wrapperPermissionAdd", ["Merger:GitCenter"]);
		}
	})
	.then(() => {
		let button = document.getElementById("create_repository");
		button.classList.remove("button-disabled");
		button.classList.add("button-blue");
		button.onclick = () => {
			Repository.createRepo(zeroPage);
		};
	});