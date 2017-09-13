class Repository {
	constructor(address, zeroPage) {
		this.address = address;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);

		this.git = new Git("merged-GitCenter/" + address + "/repo.git", zeroPage);
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

	// Git actions
	getFiles(branch, dir) {
		return this.git.getBranchCommit(branch)
			.then(commit => {
				return this.git.readUnknownObject(commit);
			})
			.then(commit => {
				if(commit.type != "commit") {
					return Promise.reject("Branch reference must be a commit");
				}

				return this.getTree(commit.content.tree);
			});
	}
	getTree(tree) {
		return this.git.readUnknownObject(tree)
			.then(tree => {
				if(tree.type != "tree") {
					return Promise.reject("Commit tree must be a tree");
				}

				return Promise.all(
					tree.content.map(file => {
						return this.git.readUnknownObject(file.id)
							.then(object => {
								if(object.type == "blob") {
									file.type = "file";
								} else if(object.type == "tree") {
									file.type = "directory";
								} else {
									file.type = "unknown";
								}

								return file;
							})
							.catch(object => {
								file.type = "error";
								return file;
							});
					})
				);
			});
	}
};