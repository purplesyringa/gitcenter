class Repository {
	constructor(address, zeroPage) {
		this.address = address;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
		this.zeroAuth = new ZeroAuth(zeroPage);
		this.zeroDB = new ZeroDB(zeroPage);

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
		return this.git.readBranchCommit(branch)
			.then(commit => {
				return this.getTree(commit.content.tree, dir);
			});
	}
	getTree(tree, dir) {
		return this.git.readTreeItem(tree, dir)
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
	getFile(branch, path) {
		return this.git.readBranchCommit(branch)
			.then(commit => {
				return this.git.readTreeItem(commit.content.tree, path);
			})
			.then(blob => {
				if(blob.type != "blob") {
					return Promise.reject("File content must be a blob");
				}

				return blob.content;
			});
	}
	getBranches() {
		return this.git.getRefList()
			.then(refs => {
				return refs
					.filter(ref => ref.indexOf("refs/heads/") == 0)
					.map(ref => ref.replace("refs/heads/", ""));
			});
	}

	// Issues
	addIssue(title, content) {
		return this.zeroAuth.requestAuth()
			.then(auth => {
				return this.zeroDB.insertRow(
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/data.json",
					"merged-GitCenter/" + this.address + "/data/users/" + auth.address + "/content.json",
					"issues",
					{
						title: title,
						body: content,
						date_added: Date.now(),
						open: 1
					},
					{
						source: "next_issue_id",
						column: "id"
					}
				);
			})
			.then(row => {
				return row.id;
			});
	}
};