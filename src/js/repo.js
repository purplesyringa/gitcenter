class Repository {
	constructor(address, zeroPage) {
		this.address = address;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
	}

	// Permission actions
	addMerger() {
		return this.zeroPage.cmd("mergerSiteList")
			.then(list => {
				if(!list[this.address]) {
					return this.zeroPage.cmd("mergerSiteAdd", [this.address]);
				}
			});
	}

	// Content actions
	getContent() {
		return this.zeroFS.readFile("merged-GitCenter/" + this.address + "/content.json")
			.then(content => JSON.parse(content));
	}
	setContent(content) {
		return this.zeroFS.writeFile("merged-GitCenter/" + this.address + "/content.json", JSON.stringify(content));
	}
	sign() {
		return this.zeroPage.cmd("siteSign");
	}

	getSigners() {
		return this.getContent()
			.then(content => {
				let signers = (
					typeof content.signers == "object" &&
					content.signers !== null &&
					content.signers instanceof Array
				) ? content.signers : [];

				if(signers.indexOf(this.address) == -1) {
					signers.push(this.address);
				}

				return signers;
			});
	}
	isOwned() {
		let signers;
		return this.getSigners()
			.then(s => {
				signers = s;

				return this.zeroPage.getUser();
			})
			.then(address => {
				return signers.indexOf(address) > -1;
			});
	}

	rename(newName) {
		return this.getContent()
			.then(content => {
				content.title = newName;
				return this.setContent(content);
			})
			.then(() => this.sign());
	}
};