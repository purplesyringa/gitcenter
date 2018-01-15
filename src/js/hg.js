class Hg {
	constructor(root, zeroPage) {
		this.root = root;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
		this.indexCache = {};
		this.hgFileName = new HgFileName;
	}
	init() {
		return Promise.resolve();
	}

	// Helper functions
	shift(num, val) {
		if(val >= 0 && val < 32) {
			return num << val;
		} else if(val < 0 && val > -32) {
			return num >> (-val);
		} else {
			return num * Math.pow(2, val);
		}
	}
	unpackInt16(str) {
		return (
			this.shift(str[0], 8) +
			this.shift(str[1], 0)
		);
	}
	unpackInt32(str) {
		return (
			this.shift(str[0], 24) +
			this.shift(str[1], 16) +
			this.shift(str[2], 8) +
			this.shift(str[3], 0)
		);
	}
	unpackInt48(str) {
		return (
			this.shift(str[0], 40) +
			this.shift(str[1], 32) +
			this.shift(str[2], 24) +
			this.shift(str[3], 16) +
			this.shift(str[4], 8) +
			this.shift(str[5], 0)
		);
	}
	unpackInt64(str) {
		return (
			this.shift(str[0], 56) +
			this.shift(str[1], 48) +
			this.shift(str[2], 40) +
			this.shift(str[3], 32) +
			this.shift(str[4], 24) +
			this.shift(str[5], 16) +
			this.shift(str[6], 8) +
			this.shift(str[7], 0)
		);
	}
	unpackSha(str) {
		return Array.from(str).map(char => {
			char = char.toString(16);
			char = "0".repeat(2 - char.length) + char;
			return char;
		}).join("");
	}
	packInt16(num) {
		if(num == -1) {
			return [0xFF, 0xFF];
		}
		return [
			this.shift(num, -8) & 0xFF,
			num & 0xFF
		];
	}
	packInt32(num) {
		if(num == -1) {
			return [0xFF, 0xFF, 0xFF, 0xFF];
		}
		return [
			this.shift(num, -24) & 0xFF,
			this.shift(num, -16) & 0xFF,
			this.shift(num, -8) & 0xFF,
			num & 0xFF
		];
	}
	packInt48(num) {
		if(num == -1) {
			return [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
		}
		return [
			this.shift(num, -40) & 0xFF,
			this.shift(num, -32) & 0xFF,
			this.shift(num, -24) & 0xFF,
			this.shift(num, -16) & 0xFF,
			this.shift(num, -8) & 0xFF,
			num & 0xFF
		];
	}
	packInt64(num) {
		if(num == -1) {
			return [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
		}
		return [
			this.shift(num, -56) & 0xFF,
			this.shift(num, -48) & 0xFF,
			this.shift(num, -40) & 0xFF,
			this.shift(num, -32) & 0xFF,
			this.shift(num, -24) & 0xFF,
			this.shift(num, -16) & 0xFF,
			this.shift(num, -8) & 0xFF,
			num & 0xFF
		];
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
		// subarray() is in-place and therefore faster, but it is not implemented in some browsers and is only for TypedArray's
		if(length === undefined) {
			return (array.subarray || array.slice).call(array, begin);
		} else {
			return (array.subarray || array.slice).call(array, begin, begin + length);
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
	decodeUTF8(bytes) {
		return decodeURIComponent(escape(this.arrayToString(bytes)));
	}
	encodeUTF8(str) {
		return this.stringToArray(unescape(encodeURIComponent(str)));
	}
	sha(string) {
		if(string instanceof Array) {
			string = new Uint8Array(string);
		} else if(typeof string == "string") {
			string = this.stringToArray(string);
		}

		let sha = new jsSHA("SHA-1", "ARRAYBUFFER");
		sha.update(string);
		return sha.getHash("HEX");
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
		return this.zeroFS.readFile(this.root + "/" + path, "arraybuffer");
	}
	peekFile(path, offset, length) {
		return this.zeroFS.peekFile(this.root + "/" + path, offset, length, "arraybuffer");
	}
	readDirectory(path, recursive) {
		return this.zeroFS.readDirectory(this.root + "/" + path, recursive);
	}
	writeFile(path, content) {
		return this.zeroFS.writeFile(this.root + "/" + path, Array.from(content).map(char => String.fromCharCode(char)).join(""), true);
	}

	// Index
	loadIndex(name) {
		if(this.indexCache[name]) {
			return Promise.resolve(this.indexCache[name]);
		} else {
			return (new HgIndex(name, this)).load()
				.then(index => {
					this.indexCache[name] = index;
					return index;
				});
		}
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
					.filter((val, i, arr) => arr.map(branch => branch.name + "@" + branch.id).indexOf(val.name + "@" + val.id) == i)
					.map((branch, i, arr) => {
						let several = arr
							.map(branch => branch.name)
							.filter(name => name == branch.name)
							.length > 1;

						if(several) {
							return branch.name + " @ " + branch.id.substr(0, 7);
						} else {
							return branch.name;
						}
					})
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
						return {
							name: line[2] || line[1],
							id: line[0]
						};
					})
					.filter(name => name.name);
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
	changeInBranchList(file, name, commit, shift) {
		return this.readFile(file)
			.then(branches => {
				branches = this.arrayToString(branches);
				branches = branches.split("\n");

				let shifted;
				if(shift) {
					shifted = branches.shift();
				}

				let line = branches
					.findIndex(line => {
						line = line.split(" ");
						return (line[2] || line[1]) == name;
					});

				if(line == -1) {
					return Promise.reject("Not found");
				}

				branches[line] = branches[line].replace(/^.*? /, commit + " ");

				if(shift) {
					branches.unshift(shifted);
				}

				branches = this.stringToArray(branches.join("\n"));
				return this.writeFile(file, branches);
			});
	}
	addToBranchList(file, name, commit, shift) {
		return this.readFile(file)
			.catch(() => shift ? this.stringToArray(commit + " 0") : [])
			.then(branches => {
				branches = this.arrayToString(branches);
				branches = branches.split("\n");

				let shifted;
				if(shift) {
					shifted = branches.shift();
				}

				branches.push(commit + " o " + name);

				if(shift) {
					branches.unshift(shifted);
				}

				branches = this.stringToArray(branches.join("\n"));
				return this.writeFile(file, branches);
			});
	}
	getBookmarkList() {
		return this.loadBranchList("bookmarks", false)
			.then(bookmarks => bookmarks.sort())
			.catch(() => []);
	}
	getTagList(branch) {
		return this.readBranchCommit(branch)
			.then(commit => {
				return this.readTreeItem(commit.content.tree, ".hgtags")
					.catch(() => ({content: []}));
			})
			.then(hgTags => {
				return this.arrayToString(hgTags.content)
					.split("\n")
					.filter(line => line)
					.map(line => {
						return line.split(" ")[1];
					});
			});
	}
	getTag(branch, tag) {
		return this.readBranchCommit(branch)
			.then(commit => {
				return this.readTreeItem(commit.content.tree, ".hgtags")
					.catch(() => Promise.reject("Unknown tag " + tag));
			})
			.then(hgTags => {
				let item = this.arrayToString(hgTags.content)
					.split("\n")
					.map(line => line.split(" "))
					.find(line => line[1] == tag);

				if(!item) {
					return Promise.reject("Unknown tag " + tag);
				}

				return item[0];
			})
	}
	getRefList() {
		// For compatibility with Git
		let branches, bookmarks, tags;
		return this.getBranchList()
			.then(b => {
				branches = b.map(branch => "refs/heads/" + branch);
				return this.getBookmarkList();
			})
			.then(b => {
				bookmarks = b.map(bookmark => "refs/heads/" + bookmark);
				return this.getTagList("default");
			})
			.then(t => {
				tags = t.map(tag => "refs/tags/" + tag);
				return [].concat(branches).concat(bookmarks).concat(tags);
			});
	}
	getRef(ref) {
		if(this.isSha(ref)) {
			return Promise.resolve(branch);
		} else if(ref.indexOf("refs/tags/") == 0) {
			return this.getTag("default", ref.replace("refs/tags/", ""));
		} else if(ref.indexOf("refs/heads/") == 0) {
			let branch = ref.replace("refs/heads/", "");

			return this.findInBranchList("cache/branch2-visible", branch, true)
				.catch(() => this.findInBranchList("cache/branch2-served", branch, true))
				.catch(() => this.findInBranchList("cache/branch2-immutable", branch, true))
				.catch(() => this.findInBranchList("cache/branch2-base", branch, true))
				.catch(() => this.findInBranchList("bookmarks", branch, false))
				.catch(() => Promise.reject("Cannot find branch " + branch));
		}
	}
	setRef(ref, commit) {
		if(ref.indexOf("refs/tags/") == 0) {
			throw new Error("Not implemented yet");
		} else if(ref.indexOf("refs/heads/") == 0) {
			let branch = ref.replace("refs/heads/", "");

			return this.changeInBranchList("cache/branch2-visible", branch, commit, true)
				.catch(() => this.changeInBranchList("cache/branch2-served", branch, commit, true))
				.catch(() => this.changeInBranchList("cache/branch2-immutable", branch, commit, true))
				.catch(() => this.changeInBranchList("cache/branch2-base", branch, commit, true))
				.catch(() => this.changeInBranchList("bookmarks", branch, commit, false))
				.catch(() => this.addToBranchList("cache/branch2-base", branch, commit, true))
				.catch(() => Promise.reject("Cannot find branch " + branch));
		}
	}
	getBranchCommit(branch) {
		if(branch == "") {
			return this.getHead()
				.then(head => this.getBranchCommit(head));
		} else if(this.isSha(branch)) {
			return Promise.resolve(branch);
		}

		return this.getRef("refs/heads/" + branch)
			.catch(() => this.getRef("refs/tags/" + branch))
			.catch(() => Promise.reject("Could not find branch " + branch));
	}
	readBranchCommit(branch) {
		return this.getBranchCommit(branch)
			.then(commit => this.readCommit(commit));
	}

	// Read objects
	readUnknownObject(sha) {
		return this.readCommit(sha)
			.catch(() => {
				if(sha.indexOf("/") > -1) {
					// sha/file.name
					return this.readHgFile(sha.substr(sha.indexOf("/") + 1), sha.substr(0, sha.indexOf("/")))
						.catch(() => {
							// Maybe a directory
							return this.readTreeItem(sha.substr(0, sha.indexOf("/")), sha.substr(sha.indexOf("/") + 1))
						});
				}

				return Promise.reject();
			})
			.catch(() => this.readTreeItem(sha, ""))
			.catch(() => Promise.reject("Could not read object " + sha));
	}
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
				let message = data.slice(data.indexOf("")).join("\n").trim(); // After first empty line
				let parent1 = metaData.parent1Rev == -1 ? null : index.getMetaData(metaData.parent1Rev).nodeId;
				let parent2 = metaData.parent2Rev == -1 ? null : index.getMetaData(metaData.parent2Rev).nodeId;

				return {
					type: "commit",
					content: {
						tree: manifest,
						author: this.toGitAuthor(author, date),
						committer: this.toGitAuthor(author, date),
						message: message,
						parents: parent2 ? [parent1, parent2] : parent1 ? [parent1] : []
					},
					id: sha
				};
			});
	}
	readManifest(sha) {
		if(sha == "4b825dc642cb6eb9a060e54bf8d69288fbee4904") {
			// Empty tree from Git. How did it appear here?
			return Promise.resolve({
				type: "tree",
				content: [],
				id: sha
			});
		}

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

				if(items.length && items.slice(-1)[0].name == "") {
					items.pop();
				}
				if(items.length && items.slice(-1)[0].name == "") {
					items.pop();
				}

				return {
					type: "tree",
					content: items,
					id: sha
				};
			});
	}
	readTreeItem(sha, path) {
		return this.readManifest(sha)
			.then(manifest => {
				let file = manifest.content.find(item => item.name == path);
				if(file) {
					// File
					return this.readHgFile(path, file.id);
				}

				if(path) {
					path += "/";
				}

				return {
					type: "tree",
					content: manifest.content
						.filter(item => item.name.indexOf(path) == 0)
						.map(item => {
							let name = item.name.replace(path, "");
							let type = "blob";
							if(name.indexOf("/") > -1) {
								name = name.substr(0, name.indexOf("/"));
								type = "tree";
							}

							return {
								name: name,
								id: item.id,
								type: type
							};
						})
						.filter((val, i, arr) => {
							return arr.map(val2 => val2.name).indexOf(val.name) == i;
						}),
					id: sha
				};
			})
	}

	readHgFile(path, sha) {
		let encodedPath = this.hgFileName.encode(path);

		let index, rev, metaData;

		return this.loadIndex("store/data/" + encodedPath)
			.then(i => {
				index = i;
				rev = index.getRev(sha);
				metaData = index.getMetaData(rev);
				return index.getData(rev);
			})
			.then(data => {
				return {
					type: "blob",
					content: data,
					id: sha
				};
			});
	}

	// Write
	writeTree(linkRev, changes, parents) {
		if(parents.length > 1) {
			return Promise.reject("No more than 1 parent is allowed for writeTree()");
		}

		let changesIds, manifest;
		return Promise.all(changes.map(change => {
			let encodedPath = this.hgFileName.encode(change.name);

			let index;
			return this.loadIndex("store/data/" + encodedPath)
				.then(i => {
					index = i;
					return index.writeRev({
						data: change.content,
						linkRev: linkRev,
						base: "self",
						parents: change.parents
					});
				})
				.then(rev => {
					return index.getMetaData(rev).nodeId;
				});
		}))
			.then(c => {
				changesIds = c;

				return this.loadIndex("store/00manifest");
			})
			.then(m => {
				manifest = m;

				return Promise.all(
					parents.map(parent => {
						let rev = manifest.getRev(parent);

						return manifest.getData(rev)
							.then(data => {
								data = this.arrayToString(data).split("\n");
								return data
									.filter(line => line)
									.map(line => {
										return {
											name: line.split("\0")[0],
											id: line.split("\0")[1]
										};
									});
							});
					})
				);
			})
			.then(parentManifests => {
				let data = Array.from(parentManifests[0] || []);
				changes.forEach((change, i) => {
					let existing = data.find(file => file.name == change.name);
					if(existing) {
						let existingPos = data.indexOf(existing);
						data[existingPos].id = changesIds[i];
					} else {
						data.push({
							name: change.name,
							id: changesIds[i]
						});
					}
				});

				// I am not sure if the following line is needed, but better more than less, right?
				data.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

				data = this.stringToArray(data.map(file => file.name + "\0" + file.id).join("\n") + "\n");

				return manifest.writeRev({
					data: data,
					linkRev: "self",
					base: "self",
					parents: parents
				});
			})
			.then(rev => {
				return manifest.getMetaData(rev).nodeId;
			});
	}
	writeCommit(commit) {
		let index, linkRev;
		return this.loadIndex("store/00changelog")
			.then(i => {
				index = i;
				linkRev = index.chunks.length;

				return Promise.all(
					commit.parents.map(parent => {
						return this.readCommit(parent)
							.then(commit => {
								return this.readManifest(commit.content.tree);
							});
					})
				);
			})
			.then(parents => {
				let changes = commit.changes.map(change => {
					change.parents = parents
						.map(parent => {
							let file = parent.content.find(file => file.name == change.name);
							return file ? file.id : null;
						})
						.filter(parent => parent);
					return change;
				});

				let parentManifests = parents.map(parent => parent.id);

				return this.writeTree(linkRev, changes, parentManifests);
			})
			.then(tree => {
				commit.tree = tree;
				commit.changes = commit.changes.map(change => change.name);
				return this.writePlainCommit(commit);
			});
	}
	writePlainCommit(commit) {
		let data = this.stringToArray(
			commit.tree + "\n" +
			commit.author + "\n" +
			commit.date + " " + ((new Date).getTimezoneOffset() * 60) + "\n" +
			commit.changes.join("\n") + "\n" +
			"\n" +
			commit.message
		);

		let index;
		return this.loadIndex("store/00changelog")
			.then(i => {
				index = i;

				return index.writeRev({
					data: data,
					linkRev: "self",
					base: "self",
					parents: commit.parents
				});
			})
			.then(rev => index.getMetaData(rev).nodeId);
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
				this.virtual = false;

				let offset = 0;
				let rev = 0;
				while(offset < index.length) {
					let chunk = this.hg.subArray(index, offset, 64);
					if(chunk.length < 64) {
						break;
					}
					chunk = this.parseChunk(chunk, rev);
					chunk.position = offset;
					this.nodeIds[chunk.nodeId] = rev;
					this.chunks.push(chunk);
					offset += 64;
					rev++;

					if(this.isInline) {
						offset += chunk.compressedLength;
					}
				}
			}, () => {
				// Create index
				this.cachedIndex = [];

				this.isInline = false;
				this.generalDelta = this.guessGeneralDelta();
				this.version = 1;
				this.version |= (this.isInline ? 1 : 0) << 16;
				this.version |= (this.generalDelta ? 1 : 0) << 17;
				this.chunkCacheSize = 65536; // Should be 65536 on remote repo
				this.chunks = [];
				this.nodeIds = {};
				this.virtual = true;
			})
			.then(() => this);
	}
	guessGeneralDelta() {
		// Returns if general delta should be used for this index
		if(this.name == "store/00changelog") {
			return false;
		} else if(this.name == "store/00manifest") {
			return true;
		} else {
			return true;
		}
	}

	writeIndex() {
		return Promise.resolve()
			.then(() => {
				if(this.virtual) {
					// Add to fncache
					return this.hg.readFile("store/fncache")
						.catch(() => [])
						.then(cache => {
							cache = this.hg.arrayToString(cache).split("\n");
							cache = cache.filter(line => line);

							cache.push(this.name.replace(/^store\//, "") + ".i");
							if(!this.isInline) {
								cache.push(this.name.replace(/^store\//, "") + ".d");
							}

							cache = this.hg.stringToArray(cache.join("\n") + "\n");
							return this.hg.writeFile("store/fncache", cache);
						});
				}
			})
			.then(() => {
				return this.hg.writeFile(this.name + ".i", this.cachedIndex);
			});
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
		if(sha == "0000000000000000000000000000000000000000") {
			return -1;
		} else if(this.nodeIds[sha] === undefined) {
			throw new Error("Unknown changeset " + sha + ": not found in " + this.name);
		}

		return this.nodeIds[sha];
	}
	getMetaData(rev) {
		return this.chunks[rev];
	}

	getData(rev) {
		if(rev == -1) {
			return Promise.resolve([]);
		}

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
		let path = this.name + (this.isInline ? ".i" : ".d");

		return this.hg.peekFile(path, offset, length);
	}

	delta(rev) {
		return this.getRevCache(rev)
			.then(cache => {
				if(cache !== null) {
					return cache;
				}

				let baseRev = this.getMetaData(rev).baseRev;
				if(baseRev != -1 && baseRev != rev) {
					return this.delta(baseRev)
						.then(base => {
							return this.mpatch(rev, base);
						});
				}

				return this.getCompressedData(rev)
					.then(data => {
						return this.hg.decompress(data);
					});
			});
	}
	mpatch(deltaRev, source) {
		return this.getCompressedData(deltaRev)
			.then(data => {
				let delta = this.hg.decompress(data);

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

				if(deltaRev % 100 == 0) {
					// Cache
					return this.cacheRev(deltaRev, dst)
						.then(() => dst);
				}

				return dst;
			});
	}

	writeRev(info) {
		if(info.parents.length > 2) {
			throw new RangeError("No more than 2 parents are allowed");
		}

		let rev = this.chunks.length;
		let offset = rev == 0 ? 0 : this.getEndPos(rev - 1);
		let flags = 0;
		let compressedLength = info.data.length + 1;
		let uncompressedLength = info.data.length;
		let baseRev = info.base == "self" ? rev : this.getRev(info.base);
		let linkRev = info.linkRev == "self" ? rev : info.linkRev;
		let parent1Rev = info.parents[0] ? this.getRev(info.parents[0]) : -1;
		let parent2Rev = info.parents[1] ? this.getRev(info.parents[1]) : -1;
		let nodeId = this.hash(info.data, info.parents);

		if(rev == 0) {
			// First revision, file was empty until now - let's write header
			offset = this.version << 16;
		}

		let code = this.hg.concat(
			this.hg.packInt48(offset),
			this.hg.packInt16(flags),
			this.hg.packInt32(compressedLength),
			this.hg.packInt32(uncompressedLength),
			this.hg.packInt32(baseRev),
			this.hg.packInt32(linkRev),
			this.hg.packInt32(parent1Rev),
			this.hg.packInt32(parent2Rev),
			this.hg.packSha(nodeId),
			[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
		);

		let chunk = {
			rev: rev,
			offset: offset,
			flags: flags,
			compressedLength: compressedLength,
			uncompressedLength: uncompressedLength,
			baseRev: baseRev,
			linkRev: linkRev,
			parent1Rev: parent1Rev,
			parent2Rev: parent2Rev,
			nodeId: nodeId,
			position: offset + (this.isInline ? (rev + 1) * 64 : 0)
		};
		this.nodeIds[nodeId] = rev;
		this.chunks[rev] = chunk;

		if(this.isInline) {
			this.cachedIndex = this.hg.concat(this.cachedIndex, code, this.hg.stringToArray("u"), info.data);
		} else {
			this.cachedIndex = this.hg.concat(this.cachedIndex, code);
		}

		let promise = Promise.resolve();
		if(!this.isInline) {
			promise = this.hg.readFile(this.name + ".d")
				.catch(data => [])
				.then(data => {
					data = this.hg.concat(data, this.hg.stringToArray("u"), info.data);
					return this.hg.writeFile(this.name + ".d", data);
				});
		}

		return promise
			.then(() => this.writeIndex())
			.then(() => rev);
	}
	hash(data, parents) {
		let nullId = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		if(parents[0] && parents[1]) {
			if(parents[0] < parents[1]) {
				return this.hg.sha(this.hg.concat(this.hg.packSha(parents[0]), this.hg.packSha(parents[1]), data));
			} else {
				return this.hg.sha(this.hg.concat(this.hg.packSha(parents[1]), this.hg.packSha(parents[0]), data));
			}
		} else if(parents[0]) {
			return this.hg.sha(this.hg.concat(nullId, this.hg.packSha(parents[0]), data));
		} else {
			return this.hg.sha(this.hg.concat(nullId, nullId, data));
		}
	}

	cacheRev(rev, data) {
		return this.hg.zeroPage.cmd("wrapperGetLocalStorage")
			.then(storage => {
				if(!storage) {
					storage = {
						repoCache: {}
					};
				} else if(!storage.repoCache) {
					storage.repoCache = {};
				}

				if(!storage.repoCache[this.address]) {
					storage.repoCache[this.address] = {
						hgCache: {
							revisions: {}
						}
					};
				}

				storage.repoCache[this.address].hgCache.revisions[this.name] = data;

				if(JSON.stringify(storage).length > 1024 * 1024) {
					storage.repoCache[this.address].hgCache = {
						revisions: {}
					};
				}

				return this.hg.zeroPage.cmd("wrapperSetLocalStorage", storage);
			});
	}
	getRevCache(rev) {
		return this.hg.zeroPage.cmd("wrapperGetLocalStorage")
			.then(storage => {
				if(!storage) {
					return null;
				} else if(!storage.repoCache) {
					return null;
				} else if(!storage.repoCache[this.hg.root]) {
					return null;
				} else if(!storage.repoCache[this.hg.root].hgCache) {
					return null;
				} else if(!storage.repoCache[this.hg.root].hgCache.revisions) {
					return null;
				} else if(typeof storage.repoCache[this.hg.root].hgCache.revisions[this.name] == "undefined") {
					return null;
				}

				return storage.repoCache[this.hg.root].hgCache.revisions[this.name];
			});
	}
};

class HgFileName {
	constructor() {
		// Encode map
		let capitals = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
			.map(char => char.charCodeAt(0));

		let cmap = {};
		for(let i = 0; i < 32; i++) {
			let hex = i.toString(16);
			hex = "0".repeat(2 - hex.length) + hex;
			cmap[i] = "~" + hex;
		}
		for(let i = 32; i < 126; i++) {
			cmap[i] = String.fromCharCode(i);
		}
		for(let i = 126; i < 256; i++) {
			let hex = i.toString(16);
			hex = "0".repeat(2 - hex.length) + hex;
			cmap[i] = "~" + hex;
		}

		Array.from("\\:*?\"<>|").forEach(char => {
			let ord = char.charCodeAt(0);
			let hex = ord.toString(16);
			hex = "0".repeat(2 - hex.length) + hex;
			cmap[ord] = "~" + hex;
		});

		for(let i = "A".charCodeAt(0); i <= "Z".charCodeAt(0); i++) {
			cmap[i] = "_" + String.fromCharCode(i).toLowerCase();
		}
		cmap["_".charCodeAt(0)] = "__";

		// Decode map
		let dmap = {};
		Object.keys(cmap).forEach(key => {
			dmap[cmap[key]] = key;
		});

		this.cmap = cmap;
		this.dmap = dmap;
	}

	encode(name) {
		name = Array.from(name)
			.map(char => char.charCodeAt(0))
			.map(ord => this.cmap[ord])
			.join("")

			.replace(/\.hg\//, ".hg.hg/")
			.replace(/\.i\//, ".i.hg/")
			.replace(/\.d\//, ".d.hg/");

		if(name[0] == ".") {
			return "~2e" + name.substr(1);
		}

		return name;
	}

	decode(name) {
		let orig = "";
		let pos = 0;
		while(pos < name.length) {
			let found = false;
			for(let i = 1; i < 4; i++) {
				if(this.dmap[name.substr(pos, i)]) {
					orig += this.dmap[name.substr(pos, i)];
					pos += i;
					found = true;
					break;
				}
			}
			if(!found) {
				throw new TypeError("Invalid name " + name);
			}
		}
		return orig;
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
		})
		.then(h => {
			hg = h;

			return hg.writePlainCommit({
				tree: "0000000000000000000000000000000000000000",
				changes: [],
				parents: [],
				author: name + " <" + email + ">",
				date: Math.floor(Date.now() / 1000),
				message: "Initial commit"
			});
		})
		.then(commit => hg.setRef("refs/heads/default", commit))
		.then(() => hg);
};