class ZeroDB {
	constructor(page) {
		if(typeof page != "object" || !page instanceof ZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
			return;
		}
		this.page = page;
		this.fs = new ZeroFS(page);
	}

	query(query) {
		return this.page.cmd("dbQuery", [query])
			.then(result => {
				if(result.error) {
					return Promise.reject(result.error);
				}

				return result;
			});
	}

	insertRow(dataFile, contentFile, table, row, autoIncrement) {
		return this.fs.readFile(dataFile)
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
						null, // private key
						contentFile // file to sign
					]
				);
			})
			.then(() => {
				_zeroPage.cmd(
					"sitePublish",
					[
						null, // private key
						contentFile, // file to publish
						false // sign before publish
					]
				);

				return row;
			});
	}
	changeRow(dataFile, contentFile, table, f) {
		return this.fs.readFile(dataFile)
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
						null, // private key
						contentFile // file to sign
					]
				);
			})
			.then(() => {
				_zeroPage.cmd(
					"sitePublish",
					[
						null, // private key
						contentFile, // file to publish
						false // sign before publish
					]
				);
			});
	}

	changePair(dataFile, contentFile, table, key, value) {
		return this.fs.readFile(dataFile)
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
						null, // private key
						contentFile // file to sign
					]
				);
			})
			.then(() => {
				_zeroPage.cmd(
					"sitePublish",
					[
						null, // private key
						contentFile, // file to publish
						false // sign before publish
					]
				);
			});
	}
};