class Git {
	constructor(root, zeroPage) {
		this.root = root;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
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
		return this.readFile("objects/" + id.substr(0, 2) + "/" + id.substr(2))
			.then(object => this.inflate(object));
	}
	findPackedObjects() {
		return this.readDirectory("objects/pack")
			.then(object => {
				let index = object.find(name => name.indexOf(".idx") > -1);
				let pack = object.find(name => name.indexOf(".pack") > -1);
				return {
					index: "objects/pack/" + index,
					pack: "objects/pack/" + pack
				};
			});
	}
	readPackedObject(id) {
		let intId = parseInt(id.substr(0, 2), 16);
		let index, pack;

		return this.findPackedObjects()
			.then(paths => {
				return Promise.all([
					this.readFile(paths.index),
					this.readFile(paths.pack)
				]);
			})
			.then(data => {
				index = data[0];
				pack = data[1];

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

					let begin = (intId == 0 ? 0 : table[intId - 1]) * 20 + 1032;
					let end = table[intId] * 20 + 1032;

					let children = index.slice(begin, end);
					children = children.match(/.{20}/g).map(part => {
						return part.split("").map(char => {
							char = char.charCodeAt(0).toString(16);
							char = "0".repeat(2 - char.length) + char;
							return char;
						}).join("");
					});
					let idOffset = (intId == 0 ? 0 : table[intId - 1]) + children.indexOf(id);

					let packOffset = index.substr(1032 + total * 24 + idOffset * 4, 4);
					packOffset = this.unpackInt32(packOffset);

					console.log(pack.substr(packOffset));
				}
			});
	}
};