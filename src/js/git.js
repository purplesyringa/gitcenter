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
	subArray(array, begin, length) {
		if(length === undefined) {
			return array.slice(begin);
		} else {
			return array.slice(begin, begin + length);
		}
	}
	appendArray(source, destination) {
		source.forEach(item => destination.push(item));
	}

	// FileSystem commands
	readFile(path) {
		return this.zeroFS.readFile(this.root + "/" + path)
			.then(file => {
				return new Uint8Array(file.split("").map(char => char.charCodeAt(0)));
			});
	}
	readDirectory(path, recursive) {
		return this.zeroFS.readDirectory(this.root + "/" + path, recursive);
	}
	inflate(string) {
		return pako.inflate(string);
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
					type: object.slice(0, object.indexOf(" ".charCodeAt(0))),
					content: object.slice(object.indexOf(0) + 1)
				};
			});
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
				if(
					Array.from(this.subArray(index, 0, 4))
						.map(char => String.fromCharCode(char))
						.join("") ==
					"ÿtOc"
				) { // New style index
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

		return this.readPackedObjectAt(packed);
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

					data = this.inflate(this.subArray(data, 20));

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
					return this.readPackedObjectAt({pack: pack, packOffset: baseOffset})
						.then(base => {
							return this.applyDelta(base, this.subArray(data, curOffset));
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
							return this.applyDelta(base.content, this.subArray(data, curOffset));
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

		return result;
	}
};