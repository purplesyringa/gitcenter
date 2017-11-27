class Hg {
	constructor(root, zeroPage) {
		this.root = root;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
	}
	init() {
		return Promise.resolve();
	}

	// Helper functions
	unpackInt16(str) {
		return (
			(str[0] << 8) +
			(str[1] << 0)
		);
	}
	unpackInt32(str) {
		return (
			(str[0] << 24) +
			(str[1] << 16) +
			(str[2] << 8) +
			(str[3] << 0)
		);
	}
	unpackInt48(str) {
		return (
			(str[0] << 40) +
			(str[1] << 32) +
			(str[2] << 24) +
			(str[3] << 16) +
			(str[4] << 8) +
			(str[5] << 0)
		);
	}
	unpackInt64(str) {
		return (
			(str[0] << 56) +
			(str[1] << 48) +
			(str[2] << 40) +
			(str[3] << 32) +
			(str[4] << 24) +
			(str[5] << 16) +
			(str[6] << 8) +
			(str[7] << 0)
		);
	}
	unpackSha(str) {
		return Array.from(str).map(char => {
			char = char.toString(16);
			char = "0".repeat(2 - char.length) + char;
			return char;
		}).join("");
	}
	packSha(str) {
		let items = str.split("").map(char => {
			if(char >= "0" && char <= "9") {
				return char.charCodeAt(0) - "0".charCodeAt(0);
			} else if(char >= "a" && char <= "z") {
				return char.charCodeAt(0) - "a".charCodeAt(0) + 10;
			}
		});
		let result = [];
		for(let i = 0; i < items.length; i += 2) {
			result.push(items[i] * 16 + items[i + 1]);
		}
		return result;
	}
	subArray(array, begin, length) {
		if(length === undefined) {
			return array.slice(begin);
		} else {
			return array.slice(begin, begin + length);
		}
	}
	appendArray(source, destination) {
		source.forEach(item => destination.push(item));
		return destination;
	}
	concat(...arrs) {
		let destination = [];
		arrs.forEach(arr => this.appendArray(arr, destination));
		return destination;
	}
	arrayToString(array) {
		return Array.from(array).map(char => String.fromCharCode(char)).join("");
	}
	stringToArray(string) {
		return string.split("").map(char => char.charCodeAt(0));
	}
	isSha(str) {
		return (
			str.length == 40 &&
			str.split("").every(char => {
				char = char.charCodeAt(0);

				return (
					(char >= "0".charCodeAt(0) && char <= "9".charCodeAt(0)) ||
					(char >= "a".charCodeAt(0) && char <= "z".charCodeAt(0))
				);
			})
		);
	}

	// Compression
	decompress(data) {
		if(data.length == 0) {
			return data;
		}

		let type = String.fromCharCode(data[0]);
		if(type == "\0") {
			return data;
		} else if(type == "x") {
			return pako.inflate(data);
		} else if(type == "u") {
			return this.subArray(data, 1);
		}
	}

	// FileSystem commands
	readFile(path) {
		return this.zeroFS.readFile(this.root + "/" + path, true)
			.then(file => {
				return new Uint8Array(file.split("").map(char => char.charCodeAt(0)));
			});
	}
	readDirectory(path, recursive) {
		return this.zeroFS.readDirectory(this.root + "/" + path, recursive);
	}
	writeFile(path, content) {
		return this.zeroFS.writeFile(this.root + "/" + path, Array.from(content).map(char => String.fromCharCode(char)).join(""), true);
	}

	// Index
	loadIndex(name) {
		return (new HgIndex(name, this)).load();
	}

	// Branches
	getBranchList() {
		let branches = [];

		return this.loadBranchList("cache/branch2-visible", true)
			.then(b => {
				branches = branches.concat(b);
				return this.loadBranchList("cache/branch2-served", true);
			})
			.then(b => {
				branches = branches.concat(b);
				return this.loadBranchList("cache/branch2-immutable", true);
			})
			.then(b => {
				branches = branches.concat(b);
				return this.loadBranchList("cache/branch2-base", true);
			})
			.then(b => {
				branches = branches.concat(b);

				return branches
					.filter((val, i, arr) => arr.indexOf(val) == i)
					.sort();
			});
	}
	loadBranchList(file, shift) {
		return this.readFile(file)
			.then(branches => {
				branches = this.arrayToString(branches);
				branches = branches.split("\n");
				if(shift) {
					branches.shift();
				}

				return branches
					.map(line => {
						line = line.split(" ");
						return line[2] || line[1];
					})
					.filter(name => name);
			}, () => []);
	}
	findInBranchList(file, name, shift) {
		return this.readFile(file)
			.then(branches => {
				branches = this.arrayToString(branches);
				branches = branches.split("\n");
				if(shift) {
					branches.shift();
				}

				return branches
					.find(line => {
						line = line.split(" ");
						return (line[2] || line[1]) == name;
					})
					.split(" ")
					[0];
			});
	}
	getBookmarkList() {
		return this.loadBranchList("bookmarks", false)
			.then(bookmarks => bookmarks.sort());
	}
	getRefList() {
		// For compatibility with Git
		let branches, bookmarks;
		return this.getBranchList()
			.then(b => {
				branches = b.map(branch => "refs/heads/" + branch);
				return this.getBookmarkList();
			})
			.then(b => {
				bookmarks = b.map(bookmark => "refs/heads/" + bookmark);
				return branches.concat(bookmarks);
			});
	}
	getBranchCommit(branch) {
		if(this.isSha(branch)) {
			return branch;
		}

		return this.findInBranchList("cache/branch2-visible", branch, true)
			.catch(() => this.findInBranchList("cache/branch2-served", branch, true))
			.catch(() => this.findInBranchList("cache/branch2-immutable", branch, true))
			.catch(() => this.findInBranchList("cache/branch2-base", branch, true))
			.catch(() => this.findInBranchList("bookmarks", branch, false));
	}
	readBranchCommit(branch) {
		return this.getBranchCommit(branch)
			.then(commit => this.readCommit(commit));
	}

	// Read objects
	readCommit(sha) {
		let index, rev, metaData;

		return this.loadIndex("store/00changelog")
			.then(i => {
				index = i;
				rev = index.getRev(sha);
				metaData = index.getMetaData(rev);
				return index.getData(rev);
			})
			.then(data => {
				data = this.arrayToString(data).split("\n");

				let manifest = data[0];
				let author = data[1];
				let date = data[2];
				let message = data.slice(4).join("\n").trim();
				let parent1 = metaData.parent1Rev == -1 ? null : index.getMetaData(metaData.parent1Rev).nodeId;
				let parent2 = metaData.parent2Rev == -1 ? null : index.getMetaData(metaData.parent2Rev).nodeId;

				return {
					type: "commit",
					content: {
						manifest: manifest,
						author: this.toGitAuthor(author, date),
						committer: this.toGitAuthor(author, date),
						message: message,
						parents: parent2 ? [parent1, parent2] : parent1 ? [parent1] : []
					}
				};
			});
	}
	readManifest(sha) {
		let index, rev, metaData;

		return this.loadIndex("store/00manifest")
			.then(i => {
				index = i;
				rev = index.getRev(sha);
				metaData = index.getMetaData(rev);
				return index.getData(rev);
			})
			.then(data => {
				let items = this.arrayToString(data).split("\n").map(row => {
					let name = row.split("\0")[0];
					let id = row.split("\0")[1];
					return {
						name: name,
						id: id
					};
				});

				if(items.slice(-1)[0].name == "") {
					items.pop();
				}

				return items;
			});
	}
	readTree(sha, path) {
		if(path) {
			path += "/";
		}

		return this.readManifest(sha)
			.then(manifest => {
				return manifest
					.filter(item => item.name.indexOf(path) == 0)
					.map(item => {
						let name = item.name.replace(path, "");
						let type = "file";
						if(name.indexOf("/") > -1) {
							name = item.name.substr(0, item.name.indexOf("/"));
							type = "directory";
						}

						return {
							name: name,
							id: item.id,
							type: type
						};
					})
					.filter((val, i, arr) => {
						return arr.map(val2 => val2.name).indexOf(val.name) == i;
					});
			})
	}

	toGitAuthor(author, date) {
		// Author
		let email = "hg";
		if(author.indexOf("<") > -1 && author.lastIndexOf(">") == author.length - 1) {
			// Probably email
			let open = author.indexOf("<");
			email = author.substr(open + 1);
			email = email.substr(0, email.length - 1);
			author = author.substr(0, open).trim();
		}

		// Date
		let ts = parseInt(date.split(" ")[0]);

		let tz = parseInt(date.split(" ")[1]);
		tz = -tz / 60;

		let tzHours = Math.abs(Math.floor(tz / 60)).toString();
		tzHours = "0".repeat(2 - tzHours.length) + tzHours;

		let tzMinutes = Math.abs(tz % 60).toString();
		tzMinutes = "0".repeat(2 - tzMinutes.length) + tzMinutes;

		let tzString = (tz < 0 ? "-" : "+") + tzHours + tzMinutes;

		return author + " <" + email + "> " + ts + " " + tzString;
	}

	getHead() {
		return Promise.resolve("default");
	}
};

class HgIndex {
	constructor(name, hg) {
		this.hg = hg;
		this.name = name;
	}

	// Util
	getStartPos(rev) {
		return this.chunks[rev].offset;
	}
	getEndPos(rev) {
		return this.getStartPos(rev) + this.getLength(rev);
	}
	getLength(rev) {
		return this.chunks[rev].compressedLength;
	}

	load() {
		return this.hg.readFile(this.name + ".i")
			.then(index => {
				this.cachedIndex = index;

				this.version = this.hg.unpackInt32(this.hg.subArray(index, 0, 4));
				this.isInline = !!(this.version & (1 << 16));
				this.generalDelta = !!(this.version & (1 << 17));
				this.chunkCacheSize = 65536; // Should be 65536 on remote repo
				this.chunks = [];
				this.nodeIds = {};

				let offset = 0;
				let rev = 0;
				while(offset < index.length) {
					let chunk = this.parseChunk(this.hg.subArray(index, offset, 64), rev);
					chunk.position = offset;
					this.nodeIds[chunk.nodeId] = rev;
					this.chunks.push(chunk);
					offset += 64;
					rev++;

					if(this.isInline) {
						offset += chunk.compressedLength;
					}
				}

				if(this.isInline) {
					this.cachedData = this.cachedIndex;
				} else {
					return this.hg.readFile(this.name + ".d")
						.then(data => {
							this.cachedData = data;
						});
				}
			})
			.then(() => this);
	}

	parseChunk(chunk, rev) {
		return {
			rev: rev,
			offset: rev == 0 ? 0 : this.hg.unpackInt48(this.hg.subArray(chunk, 0, 6)),
			flags: this.hg.unpackInt16(this.hg.subArray(chunk, 6, 2)),
			compressedLength: this.hg.unpackInt32(this.hg.subArray(chunk, 8, 4)),
			uncompressedLength: this.hg.unpackInt32(this.hg.subArray(chunk, 12, 4)),
			baseRev: this.hg.unpackInt32(this.hg.subArray(chunk, 16, 4)),
			linkRev: this.hg.unpackInt32(this.hg.subArray(chunk, 20, 4)),
			parent1Rev: this.hg.unpackInt32(this.hg.subArray(chunk, 24, 4)),
			parent2Rev: this.hg.unpackInt32(this.hg.subArray(chunk, 28, 4)),
			nodeId: this.hg.unpackSha(this.hg.subArray(chunk, 32, 20))
		};
	}

	getRev(sha) {
		if(this.nodeIds[sha] === undefined) {
			throw new Error("Unknown changeset " + sha + ": not found in " + this.name);
		}

		return this.nodeIds[sha];
	}
	getMetaData(rev) {
		return this.chunks[rev];
	}

	getData(rev) {
		return this.delta(rev);
	}
	getCompressedData(rev) {
		let start = this.getStartPos(rev);
		let end = this.getEndPos(rev);
		if(this.isInline) {
			start += (rev + 1) * 64;
			end += (rev + 1) * 64;
		}

		return this.getChunk(start, end - start);
	}
	getChunk(offset, length) {
		return this.hg.subArray(this.cachedData, offset, length);
	}

	delta(rev) {
		// Build chain
		let chain = [];
		let baseRev = rev;
		while(baseRev != -1 && baseRev != this.getMetaData(baseRev).baseRev) {
			chain.push(baseRev);
			if(this.generalDelta) {
				baseRev = this.getMetaData(baseRev).baseRev;
			} else {
				baseRev--;
			}
		}

		let data;
		if(baseRev == -1) {
			data = [];
		} else {
			data = this.hg.decompress(this.getCompressedData(baseRev));
		}

		data = chain.reverse().reduce((source, deltaRev) => this.mpatch(deltaRev, source), data);
		return data;
	}
	mpatch(deltaRev, source) {
		let delta = this.hg.decompress(this.getCompressedData(deltaRev));

		let dst = source;
		let dstOffset = 0;

		let pos = 0;
		while(pos < delta.length) {
			let start = this.hg.unpackInt32(this.hg.subArray(delta, pos, 4));
			let end = this.hg.unpackInt32(this.hg.subArray(delta, pos + 4, 4));
			let length = this.hg.unpackInt32(this.hg.subArray(delta, pos + 8, 4));
			let data = this.hg.subArray(delta, pos + 12, length);

			dst = this.hg.concat(this.hg.subArray(dst, 0, start + dstOffset), data, this.hg.subArray(dst, end + dstOffset));

			dstOffset -= end - start;
			dstOffset += length;

			pos += 12 + length;
		}

		return dst;
	}
};

Hg.init = (root, zeroPage, name, email) => {
	let zeroFS = new ZeroFS(zeroPage);

	let hg;

	return zeroFS.writeFile(root + "/00changelog.i", "\x00\x00\x00\x02dummy")
		.then(() => {
			return zeroFS.writeFile(root + "/requires", "dotencode\nfncache\ngeneraldelta\nrevlogv1\nstore\n");
		})
		.then(() => {
			return new Hg(root, zeroPage);
		});
};