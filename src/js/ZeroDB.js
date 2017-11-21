class ZeroDB {
	constructor(page) {
		if(typeof page != "object" || !page instanceof ZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
			return;
		}
		this.page = page;
		this.fs = new ZeroFS(page);
		this.auth = new ZeroAuth(page);
	}

	query(query, placeholders) {
		return this.page.cmd("dbQuery", [query, placeholders])
			.then(result => {
				if(result.error) {
					return Promise.reject(result.error);
				}

				return result;
			});
	}

	getPrivateKey(contentFile) {
		let auth = this.auth.getAuth();
		return this.page.cmd("fileRules", [contentFile])
			.then(rules => {
				if(auth && rules.signers.indexOf(auth.address) > -1) {
					return null;
				}

				return "stored";
			});
	}

	insertRow(dataFile, contentFile, table, row, autoIncrement) {
		let privatekey;
		return this.getPrivateKey(contentFile)
			.then(p => {
				privatekey = p;

				return this.fs.readFile(dataFile);
			})
			.then(data => {
				return JSON.parse(data);
			}, () => {
				return {};
			})
			.then(data => {
				if(typeof data[table] != "object" || !(data[table] instanceof Array)) {
					data[table] = [];
				}

				if(autoIncrement) {
					if(!data[autoIncrement.source]) {
						data[autoIncrement.source] = 0;
					}

					row[autoIncrement.column] = data[autoIncrement.source]++;
				}

				data[table].push(row);

				return this.fs.writeFile(dataFile, JSON.stringify(data, null, 4));
			})
			.then(() => {
				return this.page.cmd(
					"siteSign",
					[
						privatekey, // private key
						contentFile // file to sign
					]
				);
			})
			.then(() => {
				this.page.cmd(
					"sitePublish",
					[
						privatekey, // private key
						contentFile, // file to publish
						false // sign before publish
					]
				);

				return row;
			});
	}
	changeRow(dataFile, contentFile, table, f) {
		let privatekey;
		return this.getPrivateKey(contentFile)
			.then(p => {
				privatekey = p;

				return this.fs.readFile(dataFile);
			})
			.then(data => {
				return JSON.parse(data);
			}, () => {
				return {};
			})
			.then(data => {
				if(typeof data[table] != "object" || !(data[table] instanceof Array)) {
					data[table] = [];
				}

				data[table] = data[table].map(f);

				return this.fs.writeFile(dataFile, JSON.stringify(data, null, 4));
			})
			.then(() => {
				return this.page.cmd(
					"siteSign",
					[
						privatekey, // private key
						contentFile // file to sign
					]
				);
			})
			.then(() => {
				this.page.cmd(
					"sitePublish",
					[
						privatekey, // private key
						contentFile, // file to publish
						false // sign before publish
					]
				);
			});
	}

	changePair(dataFile, contentFile, table, key, value) {
		let privatekey;
		return this.getPrivateKey(contentFile)
			.then(p => {
				privatekey = p;

				return this.fs.readFile(dataFile);
			})
			.then(data => {
				return JSON.parse(data);
			}, () => {
				return {};
			})
			.then(data => {
				if(typeof data[table] != "object") {
					data[table] = {};
				}

				data[table][key] = value;

				return this.fs.writeFile(dataFile, JSON.stringify(data, null, 4));
			})
			.then(() => {
				return this.page.cmd(
					"siteSign",
					[
						privatekey, // private key
						contentFile // file to sign
					]
				);
			})
			.then(() => {
				this.page.cmd(
					"sitePublish",
					[
						privatekey, // private key
						contentFile, // file to publish
						false // sign before publish
					]
				);
			});
	}

	getJsonID(path, version) {
		let where;
		if(version == 1) {
			where = {
				path: path
			};
		} else if(version == 2) {
			path = path.split("/");
			where = {
				directory: path.slice(0, -1).join("/"),
				file_name: path.slice(-1)[0]
			};
		} else if(version == 3) {
			path = path.split("/");
			where = {
				site: path[0],
				directory: path.slice(1, -1).join("/"),
				file_name: path.slice(-1)[0]
			};
		}

		return this.query("SELECT * FROM json WHERE ?", where)
			.then(json => {
				return json.length ? json[0].json_id : -1;
			});
	}
};