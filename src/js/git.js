class Git {
	constructor(root, zeroPage) {
		this.root = root;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);

		this.packedIndex = [];
		this.findPackedObjects()
			.then(objects => {
				objects.forEach(object => {
					this.loadPackedIndex(object.index);
				});
			});
	}

	// Helper functions
	unpackInt32(str) {
		return (
			(str.charCodeAt(0) << 24) +
			(str.charCodeAt(1) << 16) +
			(str.charCodeAt(2) << 8) +
			(str.charCodeAt(3) << 0)
		);
	}
	unpackInt64(str) {
		return (
			(str.charCodeAt(0) << 56) +
			(str.charCodeAt(1) << 48) +
			(str.charCodeAt(2) << 40) +
			(str.charCodeAt(3) << 32) +
			(str.charCodeAt(4) << 24) +
			(str.charCodeAt(5) << 16) +
			(str.charCodeAt(6) << 8) +
			(str.charCodeAt(7) << 0)
		);
	}

	// FileSystem commands
	readFile(path) {
		return this.zeroFS.readFile(this.root + "/" + path);
	}
	readDirectory(path, recursive) {
		return this.zeroFS.readDirectory(this.root + "/" + path, recursive);
	}
	inflate(string) {
		return pako.inflate(string, {to: "string"});
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
			.then(object => this.inflate(object));
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
				if(index.substr(0, 4) == "ÿtOc") { // New style index
					// 4 bytes - magic string
					// 4 bytes = 2
					// 256 * 4 bytes - fanout - numbers of objects in the corresponding pack, where first byte is <= N
					// x * 20 bytes - object names
					// x * 4 bytes - crc32
					// x * 4 bytes - pack offsets

					let fanout = index.substr(8, 256 * 4);
					let table = [];
					for(let i = 0; i < 256 * 4; i += 4) {
						table.push(this.unpackInt32(fanout.substr(i, 4)));
					}

					let total = table[255];

					for(let i = 0; i < total; i++) {
						let part = index.substr(i * 20 + 1032, 20);

						let id = part.split("").map(char => {
							char = char.charCodeAt(0).toString(16);
							char = "0".repeat(2 - char.length) + char;
							return char;
						}).join("");

						let packOffset = index.substr(1032 + total * 24 + i * 4, 4);
						packOffset = this.unpackInt32(packOffset);

						if((packOffset >> 31) == 0) {
							// Leave as is
						} else {
							packOffset = packOffset & 0x7FFFFFFF;
							packOffset = index.substr(1032 + total * 28 + packOffset * 8, 8);
							packOffset = this.unpackInt64(packOffset);
						}

						this.packedIndex.push({
							id: id,
							packOffset: packOffset
						});
					}
				}
			});
	}
	loadPack(path) {
		return this.readFile(path)
			.then(pack => {
				this.packedIndex
					.forEach((item, i) => {
						let nextOffset = i == this.packedIndex.length - 1 ? pack.length : this.packedIndex[i + 1];
						let val = pack.charCodeAt(item.packOffset);

						let msb = val & 128;
						let type = (val >> 4) & 7;
						let length = val & 16;

						let curOffset = item.packOffset + 1;
						while(msb) {
							let val = pack.charCodeAt(curOffset++);
							length = (length << 7) + (val & 127);
							msb = val & 128;
						}

						let data = pack.substr(curOffset, length);

						if(type <= 3) {
							if(data) {
								data = this.inflate(data);
							}
							console.log(item.id, type, data);
							if(type == 0) {
								// tag
							} else if(type == 1) {
								// commit
							} else if(type == 2) {
								// tree
							} else if(type == 3) {
								// blob
							}
						} else if(type == 6) {
							// OFS delta
						} else if(type == 7) {
							// REF delta
						}
					});
			});
	}
};