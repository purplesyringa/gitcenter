class Git {
	constructor(root, zeroPage) {
		this.root = root;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
	}
	init() {
		this.packedIndex = [];
		return this.findPackedObjects()
			.then(objects => {
				objects.forEach(object => {
					this.loadPackedIndex(object.index);
				});
			});
	}

	// Helper functions
	unpackInt32(str) {
		return (
			(str[0] << 24) +
			(str[1] << 16) +
			(str[2] << 8) +
			(str[3] << 0)
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
		if(typeof array == "string") {
			return array;
		}
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
	parseConfig(config) {
		let result = {
			"": {}
		};
		let currentGroup = "";

		config.split("\n").forEach(line => {
			line = line.trim();

			if(line[0] == ";") {
				// Comment
				return;
			} else if(line[0] == "[" && line[line.length - 1] == "]") {
				// Group
				currentGroup = line.substr(1, line.length - 2);
				result[currentGroup] = {};
			} else {
				let key = line.substr(0, line.indexOf("=")).trim();
				let value = line.substr(line.indexOf("=") + 1).trim();

				result[currentGroup][key] = value;
			}
		});

		return result;
	}
	decodeUTF8(bytes) {
		return decodeURIComponent(escape(this.arrayToString(bytes)));
	}
	encodeUTF8(str) {
		return this.stringToArray(unescape(encodeURIComponent(str)));
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

	inflate(string) {
		return pako.inflate(string);
	}
	deflate(string) {
		return pako.deflate(string);
	}
	sha(string) {
		if(string instanceof Array) {
			string = new Uint8Array(string);
		}

		let sha = new jsSHA("SHA-1", "ARRAYBUFFER");
		sha.update(string);
		return sha.getHash("HEX");
	}

	// Object commands
	readObject(id) {
		if(this.packedIndex.some(packed => packed.id == id)) {
			return this.readPackedObject(id);
		} else {
			return this.readUnpackedObject(id);
		}
	}
	readUnpackedObject(id) {
		return this.readFile("objects/" + id.substr(0, 2) + "/" + id.substr(2))
			.then(object => this.inflate(object))
			.then(object => {
				return {
					type: this.arrayToString(object.slice(0, object.indexOf(" ".charCodeAt(0)))),
					content: object.slice(object.indexOf(0) + 1),
					id: id
				};
			});
	}
	writeObject(type, content) {
		let data = this.concat(this.stringToArray(type + " " + content.length), [0], content);
		let id = this.sha(data);

		return this.writeFile("objects/" + id.substr(0, 2) + "/" + id.substr(2), this.deflate(data))
			.then(() => id);
	}

	// Packed objects
	findPackedObjects() {
		return this.readDirectory("objects/pack")
			.then(object => {
				let indexes = object.filter(name => name.indexOf(".idx") > -1);
				let packs = indexes.map(index => index.replace(".idx", ".pack"));
				return indexes.map((index, i) => ({
					index: "objects/pack/" + index,
					pack: "objects/pack/" + packs[i]
				}));
			});
	}
	loadPackedIndex(path) {
		return this.readFile(path)
			.then(index => {
				if(this.arrayToString(this.subArray(index, 0, 4)) == "ÿtOc") { // New style index
					// 4 bytes - magic string
					// 4 bytes = 2
					// 256 * 4 bytes - fanout - numbers of objects in the corresponding pack, where first byte is <= N
					// x * 20 bytes - object names
					// x * 4 bytes - crc32
					// x * 4 bytes - pack offsets

					let fanout = this.subArray(index, 8, 256 * 4);
					let table = [];
					for(let i = 0; i < 256 * 4; i += 4) {
						table.push(this.unpackInt32(this.subArray(fanout, i, 4)));
					}

					let total = table[255];

					for(let i = 0; i < total; i++) {
						let part = this.subArray(index, i * 20 + 1032, 20);

						let id = this.unpackSha(part);

						let packOffset = this.subArray(index, 1032 + total * 24 + i * 4, 4);
						packOffset = this.unpackInt32(packOffset);

						if((packOffset >> 31) == 0) {
							// Leave as is
						} else {
							packOffset = packOffset & 0x7FFFFFFF;
							packOffset = this.subArray(index, 1032 + total * 28 + packOffset * 8, 8);
							packOffset = this.unpackInt64(packOffset);
						}

						this.packedIndex.push({
							id: id,
							packOffset: packOffset,
							pack: path.replace(".idx", ".pack")
						});
					}
				} else {
					return Promise.reject("Old style index not supported");
				}
			});
	}
	readPackedObject(object) {
		let packed = this.packedIndex.find(packed => packed.id == object);
		if(!packed) {
			return Promise.reject("Unknown packed object " + object);
		}

		return this.readPackedObjectAt(packed)
			.then(result => {
				result.id = object;
				return result;
			});
	}
	readPackedObjectAt(packed) {
		return this.readFile(packed.pack)
			.then(pack => {
				let val = pack[packed.packOffset];

				let msb = val & 128;
				let type = (val >> 4) & 7;
				let length = val & 15;

				let packOffset = packed.packOffset + 1;
				while(msb) {
					let val = pack[packOffset++];
					length = ((length + 1) << 7) | (val & 127);
					msb = val & 128;
				}

				let data = this.subArray(pack, packOffset);

				if(type <= 4) {
					if(data) {
						data = this.inflate(data);
					}

					return {
						type: ["", "commit", "tree", "blob", "tag"][type],
						content: data
					};
				} else if(type == 6) {
					// OFS delta
					let curOffset = 0;

					let val = data[curOffset++];
					let baseOffset = val & 127;
					let msb = val & 128;
					while(msb) {
						let val = data[curOffset++];
						baseOffset = ((baseOffset + 1) << 7) | (val & 127);
						msb = val & 128;
					}
					baseOffset = packed.packOffset - baseOffset;

					data = this.inflate(this.subArray(data, curOffset));

					curOffset = 0;
					let baseLength = 0;
					let index = 0;
					do {
						let val = data[curOffset++];
						baseLength |= (val & 127) << index;
						index += 7;
						msb = val & 128;
					} while(msb);

					let resultLength = 0;
					index = 0;
					do {
						let val = data[curOffset++];
						resultLength |= (val & 127) << index;
						index += 7;
						msb = val & 128;
					} while(msb);

					// Find base
					return this.readPackedObjectAt({pack: packed.pack, packOffset: baseOffset})
						.then(base => {
							return {
								type: base.type,
								content: this.applyDelta(base.content, this.subArray(data, curOffset))
							};
						});
				} else if(type == 7) {
					// REF delta
					let base = this.unpackSha(this.subArray(data, 0, 20));
					data = this.inflate(this.subArray(data, 20));

					let curOffset = 0;

					let baseLength = 0;
					let index = 0;
					do {
						let val = data[curOffset++];
						baseLength |= (val & 127) << index;
						index += 7;
						msb = val & 128;
					} while(msb);

					let resultLength = 0;
					index = 0;
					do {
						let val = data[curOffset++];
						resultLength |= (val & 127) << index;
						index += 7;
						msb = val & 128;
					} while(msb);

					// Find base
					return this.readObject(base)
						.then(base => {
							return {
								type: base.type,
								content: this.applyDelta(base.content, this.subArray(data, curOffset))
							};
						});
				}
			});
	}

	applyDelta(base, delta) {
		let result = [];
		let curOffset = 0;

		while(curOffset < delta.length) {
			let opcode = delta[curOffset++];
			if(opcode & 128) {
				// Copy
				let copyOffset = 0;
				let shift = 0;
				for(let i = 0; i < 4; i++) {
					if(opcode & 1) {
						copyOffset |= delta[curOffset++] << shift;
					}
					opcode >>= 1;
					shift += 8;
				}

				let copyLength = 0;
				shift = 0;
				for(let i = 0; i < 3; i++) {
					if(opcode & 1) {
						copyLength |= delta[curOffset++] << shift;
					}
					opcode >>= 1;
					shift += 8;
				}

				copyLength = copyLength || 1 << 16;

				this.appendArray(this.subArray(base, copyOffset, copyLength), result);
			} else {
				// Insert
				let length = opcode & 127;
				this.appendArray(this.subArray(delta, curOffset, length), result);
				curOffset += length;
			}
		}

		return new Uint8Array(result);
	}

	// Object-type affected commands
	readUnknownObject(id) {
		return this.readObject(id)
			.then(object => {
				if(object.type == "blob") {
					object.content = this.parseBlob(object);
				} else if(object.type == "tree") {
					object.content = this.parseTree(object);
				} else if(object.type == "commit") {
					object.content = this.parseCommit(object);
				} else if(object.type == "tag") {
					object.content = this.parseTag(object);
				}

				return object;
			});
	}
	parseBlob(object) {
		return object.content;
	}
	parseTree(object) {
		let currentPos = 0;
		let items = [];

		while(currentPos < object.content.length) {
			let spacePos = object.content.indexOf(" ".charCodeAt(0), currentPos);
			let mode = this.arrayToString(this.subArray(object.content, currentPos, spacePos - currentPos));
			currentPos = spacePos + 1;

			let nulPos = object.content.indexOf(0, currentPos);
			let name = this.decodeUTF8(this.subArray(object.content, currentPos, nulPos - currentPos));
			currentPos = nulPos + 1;

			let objectId = this.unpackSha(this.subArray(object.content, currentPos, 20));
			currentPos += 20;

			items.push({
				type: mode.length == 6 && mode.indexOf("10") == 0 ? "blob" : mode.indexOf("16") == 0 ? "submodule" : "tree",
				name: name,
				id: objectId
			});
		}

		return items;
	}
	parseCommit(object) {
		let tree = "";
		let parents = [];
		let author = "";
		let committer = "";

		let currentPos = 0;
		while(true) {
			let end = object.content.indexOf("\n".charCodeAt(0), currentPos);
			if(end == -1) {
				break;
			}

			let line = this.arrayToString(this.subArray(object.content, currentPos, end - currentPos));
			currentPos = end + 1;
			let opcode = line.substr(0, line.indexOf(" "));

			if(opcode == "tree") {
				tree = line.substr(opcode.length).trim();
			} else if(opcode == "parent") {
				parents.push(line.substr(opcode.length).trim());
			} else if(opcode == "author") {
				author = this.decodeUTF8(line.substr(opcode.length).trim());
			} else if(opcode == "committer") {
				committer = this.decodeUTF8(line.substr(opcode.length).trim());
			} else if(line == "") {
				break;
			}
		}

		let message = this.decodeUTF8(this.subArray(object.content, currentPos));

		return {
			tree: tree,
			parents: parents,
			author: author,
			committer: committer,
			message: message
		};
	}
	parseTag(object) {
		let target = "";
		let type = "";
		let tag = "";
		let tagger = "";

		let currentPos = 0;
		while(true) {
			let end = object.content.indexOf("\n".charCodeAt(0), currentPos);
			if(end == -1) {
				break;
			}

			let line = this.arrayToString(this.subArray(object.content, currentPos, end - currentPos));
			currentPos = end + 1;
			let opcode = line.substr(0, line.indexOf(" "));

			if(opcode == "object") {
				target = line.substr(opcode.length).trim();
			} else if(opcode == "type") {
				type = line.substr(opcode.length).trim();
			} else if(opcode == "tag") {
				tag = line.substr(opcode.length).trim();
			} else if(opcode == "tagger") {
				tagger = this.decodeUTF8(line.substr(opcode.length).trim());
			} else if(line == "") {
				break;
			}
		}

		let message = this.decodeUTF8(this.subArray(object.content, currentPos));

		return {
			target: target,
			type: type,
			tag: tag,
			tagger: tagger,
			message: message
		};
	}

	readTreeItem(tree, path) {
		if(typeof path == "string") {
			path = path.split("/").filter(item => item.length);
		}

		if(path.length == 0) {
			return this.readUnknownObject(tree);
		}

		return this.readUnknownObject(tree)
			.then(treeObject => {
				if(treeObject.type != "tree") {
					return Promise.reject(tree + " is not a tree");
				}

				let file = treeObject.content.find(item => item.name == path[0]);

				if(!file) {
					return Promise.reject("Tree " + tree + " has no object named " + path[0]);
				}

				path.shift();
				return this.readTreeItem(file.id, path);
			});
	}

	// Object saving
	writeBlob(content) {
		return this.writeObject("blob", content);
	}
	writeTree(items) {
		items = items.sort((a, b) => {
			let aName = a.name;
			let bName = b.name;
			if(a.type == "tree") {
				aName += "/";
			}
			if(b.type == "tree") {
				bName += "/";
			}

			return aName < bName ? -1 : aName > bName ? 1 : 0;
		});

		let content = [];
		items.forEach(item => {
			this.appendArray(this.concat(this.encodeUTF8((item.type == "tree" ? "040000" : "100644") + " " + item.name), [0], this.packSha(item.id)), content);
		});
		return this.writeObject("tree", content);
	}
	writeTreeRecursive(items) {
		let content = items.map(item => {
			if(item.type == "tree") {
				if(item.id) {
					// Use existing tree
					return Promise.resolve({
						type: "tree",
						name: item.name,
						id: item.id
					});
				}

				return this.writeTreeRecursive(item.content)
					.then(id => {
						return {
							type: "tree",
							name: item.name,
							id: id
						};
					});
			} else if(item.type == "blob") {
				if(item.id) {
					// Use existing blob
					return Promise.resolve({
						type: "blob",
						name: item.name,
						id: item.id
					});
				}

				return this.writeBlob(item.content)
					.then(id => {
						return {
							type: "blob",
							name: item.name,
							id: id
						};
					});
			}
		});
		return Promise.all(content)
			.then(content => {
				return this.writeTree(content);
			});
	}
	writePlainCommit(commit) {
		let content = "";
		content += "tree " + commit.tree + "\n";
		content += commit.parents.map(parent => "parent " + parent + "\n").join("");
		content += "author " + commit.author + "\n";
		content += "committer " + commit.committer + "\n";
		content += "\n";
		content += commit.message;

		return this.writeObject("commit", this.encodeUTF8(content));
	}
	writeCommit(commit) {
		return this.writeTreeRecursive(commit.tree)
			.then(treeId => {
				commit.tree = treeId;
				return this.writePlainCommit(commit);
			});
	}

	// Refs commands
	getRef(ref) {
		return this.readFile(ref)
			.then(content => {
				content = this.arrayToString(content);

				if(content.indexOf("ref:") == 0) {
					// Alias
					return this.getRef(content.substr(4).trim());
				} else {
					// SHA
					return content.trim();
				}
			}, () => {
				// Check packed-refs
				return this.readFile("packed-refs")
					.then(packedRefs => {
						let packedRef = this.arrayToString(packedRefs)
							.split("\n")
							.filter(line => {
								return line.trim()[0] != "#"; // Comment
							})
							.map(line => {
								return {
									id: line.substr(0, line.indexOf(" ")),
									ref: line.substr(line.indexOf(" ") + 1)
								};
							})
							.find(line => line.ref == ref);

						if(!packedRef) {
							return Promise.reject();
						}

						return packedRef.id;
					})
					.catch(() => {
						return Promise.reject("Unknown ref " + ref);
					});
			});
	}
	setRef(ref, commit) {
		return this.writeFile(ref, this.stringToArray(commit));
	}
	getBranchCommit(branch) {
		// Fallback for branch id
		if(this.isSha(branch)) {
			return Promise.resolve(branch);
		}

		if(branch == "") {
			return this.getHead()
				.then(head => this.getBranchCommit(head));
		}

		return this.getRef("refs/heads/" + branch)
			.catch(() => {
				return this.getRef("refs/tags/" + branch);
			});
	}
	readBranchCommit(branch) {
		return this.getBranchCommit(branch)
			.then(commit => this.readUnknownObject(commit))
			.then(commit => {
				if(commit.type == "tag") {
					return this.readUnknownObject(commit.content.target);
				} else if(commit.type != "commit") {
					return Promise.reject("Branch must reference to a commit, not a " + commit.type);
				} else {
					return commit;
				}
			});
	}

	getRefList() {
		let refs;
		return this.readDirectory("refs", true)
			.then(unpackedRefs => {
				refs = unpackedRefs.map(ref => "refs/" + ref);

				return this.readFile("packed-refs").catch(() => "");
			})
			.then(packedRefs => {
				packedRefs = this.arrayToString(packedRefs)
					.split("\n")
					.filter(line => {
						return line.trim()[0] != "#"; // Comment
					})
					.filter(line => line.length)
					.map(line => {
						return line.substr(line.indexOf(" ") + 1);
					})
					.forEach(ref => {
						if(refs.indexOf(ref) == -1) {
							refs.push(ref);
						}
					});

				return refs;
			});
	}

	getHead() {
		return this.readFile("HEAD")
			.then(head => {
				return this.arrayToString(head).replace(/^ref:\s*refs\/heads\//, "").trim();
			}, () => {
				return Promise.reject("No HEAD ref");
			});
	}

	// Pair-repo actions
	importObject(other, id) {
		return this.readObject(id)
			.then(object => {
				// Already exists
				return false;
			}, () => {
				let object;
				return other.readObject(id)
					.then(o => {
						object = o;
						return this.writeObject(object.type, object.content);
					})
					.then(newId => {
						if(newId != id) {
							return Promise.reject("SHA1 mismatch during importing " + id + " (received " + newId + ") from " + other + " to " + this);
						}

						return true;
					});
			});
	}
	importObjectWithDependencies(other, id) {
		return this.importObject(other, id)
			.then(imported => {
				if(!imported) {
					// Already have object and dependencies locally
					return;
				}

				return this.readUnknownObject(id)
					.then(object => {
						if(object.type == "blob") {
							return this.importBlobDependencies(other, object);
						} else if(object.type == "tree") {
							return this.importTreeDependencies(other, object);
						} else if(object.type == "commit") {
							return this.importCommitDependencies(other, object);
						}
					});
			});
	}
	importBlobDependencies(other, blob) {
		// Blob has no dependencies
		return Promise.resolve();
	}
	importTreeDependencies(other, tree) {
		return Promise.all(
			tree.content.map(item => {
				return this.importObjectWithDependencies(other, item.id);
			})
		);
	}
	importCommitDependencies(other, commit) {
		return Promise.all(
			[
				this.importObjectWithDependencies(other, commit.content.tree), // Import tree
			].concat(
				commit.content.parents.map(parent => {
					return this.importObjectWithDependencies(other, parent) // Import parents
				})
			)
		);
	}

	makeTreeDelta(base, changes) {
		// changes:
		// [
		//     {
		//         name: "dir",
		//         type: "tree",
		//         content: [
		//             {
		//                 name: "subdir",
		//                 type: "tree",
		//                 content: [
		//                     {
		//                         name: "subfile",
		//                         type: "blob",
		//                         content: "neworchangedfile"
		//                     }
		//                 ]
		//             }
		//         ]
		//     },
		//     {
		//         name: "file",
		//         remove: true
		//     },
		//     {
		//         name: "olddir",
		//         type: "blob",
		//         content: "fds"
		//     }
		// ]
		//
		// Should be read as:
		// 1. Set <dir/subdir/subfile> blob to "neworchangedfile"
		// 2. Remove <file>
		// 3. Remove tree <olddir> and add blob <olddir>

		let promise = Promise.all(
			changes.map(change => {
				let treeItemIndex = base.findIndex(item => item.name == change.name);

				if(change.remove) {
					// Remove
					if(treeItemIndex > -1) {
						base.splice(treeItemIndex, 1);
					}
				} else if(change.type == "blob") {
					if(treeItemIndex == -1) {
						// Add blob
						base.push(change);
					} else {
						// Change type to blob or change blob
						base[treeItemIndex] = change;
					}
				} else if(change.type == "tree") {
					if(treeItemIndex == -1) {
						// Add tree
						base.push(change);
					} else if(base[treeItemIndex].type != "tree") {
						// Change type to tree
						base[treeItemIndex] = change;
					} else {
						// Change tree
						let id = base[treeItemIndex].id;
						delete base[treeItemIndex].id;
						return this.readUnknownObject(id)
							.then(subTree => {
								return this.makeTreeDelta(subTree.content, change.content);
							})
							.then(delta => {
								base[treeItemIndex].content = delta;
							});
					}
				}

				return Promise.resolve();
			})
		);

		return promise.then(() => base);
	}
	makeTreeDeltaPath(base, changes) {
		// changes:
		// [
		//     path: "dir/subdir/subfile",
		//     type: "blob",
		//     content: "hhgfd"
		// ]

		let tree = {
			name: "",
			type: "tree",
			content: []
		};

		changes.forEach(change => {
			let currentTree = tree;
			change.path.split("/")
				.filter(item => item.length)
				.forEach(pathPart => {
					let item = currentTree.content.find(item => item.name == pathPart);
					if(!item) {
						item = {
							name: pathPart,
							type: "tree",
							content: []
						};
						currentTree.content.push(item);
					}

					currentTree = item;
				});

			currentTree.type = change.type;
			currentTree.content = change.content;
			currentTree.remove = change.remove;
		});

		return this.makeTreeDelta(base, tree.content);
	}

	// Submodules
	getSubmodules(tree) {
		return this.readUnknownObject(tree)
			.then(tree => {
				let blob = tree.content.find(item => item.type == "blob" && item.name == ".gitmodules");
				if(!blob) {
					return Promise.reject("No .gitmodules");
				}

				return this.readUnknownObject(blob.id);
			})
			.then(gitmodules => {
				return this.parseConfig(this.decodeUTF8(gitmodules.content));
			})
			.then(moduleList => {
				let submodules = [];

				Object.keys(moduleList).forEach(group => {
					if(group.indexOf("submodule") == -1) {
						return;
					}

					let name = group.match(/^submodule "(.*)"$/)[1];
					let path = moduleList[group].path;
					let url = moduleList[group].url;

					submodules.push({
						name: name,
						path: path,
						url: url
					});
				});

				return submodules;
			})
			.catch(() => []);
	}

	changeHooks(hooks) {
		if(hooks) {
			return Promise.all([
				this.zeroFS.readFile("assets/pre-receive")
					.then(preReceive => {
						return this.zeroFS.writeFile(this.root + "/hooks/pre-receive", preReceive);
					}),
				this.zeroFS.readFile("assets/post-receive")
					.then(postReceive => {
						return this.zeroFS.writeFile(this.root + "/hooks/post-receive", postReceive);
					})
			]);
		} else {
			return Promise.all([
				this.zeroFS.deleteFile(this.root + "/hooks/pre-receive"),
				this.zeroFS.deleteFile(this.root + "/hooks/post-receive")
			]);
		}
	}

	toString() {
		return "<Git " + this.root + ">";
	}
};

Git.init = (root, zeroPage, name, email) => {
	let zeroFS = new ZeroFS(zeroPage);

	let git;

	return zeroFS.writeFile(root + "/HEAD", "ref: refs/heads/master")
		.then(() => {
			return zeroFS.writeFile(root + "/description", "Git Center repository");
		})
		.then(() => {
			return zeroFS.writeFile(root + "/config", "[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = true\n\tsymlinks = false\n\tignorecase = true\n[receive]\n\tadvertisePushOptions = true\n\tdenyDeleteCurrent = warn\n");
		})
		.then(() => {
			git = new Git(root, zeroPage);

			return git.init();
		})
		.then(() => {
			let date = new Date;
			let tz = date.getTimezoneOffset() * -1;
			let hours = Math.floor(Math.abs(tz / 60));
			let minutes = Math.abs((tz + 60) % 60);
			tz = (tz > 0 ? "+" : "-") + (hours < 10 ? "0" : "") + hours + (minutes < 10 ? "0" : "") + minutes;

			let author = name + " <" + email + "> " + Math.floor(+date / 1000) + " " + tz;

			return git.writeCommit({
				tree: [],
				parents: [],
				author: author,
				committer: author,
				message: "Initial commit"
			});
		})
		.then(id => {
			return git.setRef("refs/heads/master", id);
		})
		.then(() => git);
};