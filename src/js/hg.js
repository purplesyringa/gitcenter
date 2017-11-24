class Hg {
	constructor(root, zeroPage) {
		this.root = root;
		this.zeroPage = zeroPage;
		this.zeroFS = new ZeroFS(zeroPage);
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
		let result = {
			chunks: []
		};

		return this.readFile(name + ".i")
			.then(index => {
				result.version = this.unpackInt32(this.subArray(index, 0, 4));
				result.isInline = !!(result.version & (1 << 16));

				let offset = 0;
				while(offset < index.length) {
					let chunk = this.parseIndexChunk(this.subArray(index, offset, 64));
					result.chunks.push(chunk);
					offset += 64;

					if(result.isInline) {
						offset += chunk.compressedLength;
					}
				}

				return result;
			});
	}
	parseIndexChunk(chunk) {
		return {
			offset: this.unpackInt48(this.subArray(chunk, 0, 6)),
			flags: this.unpackInt16(this.subArray(chunk, 6, 2)),
			compressedLength: this.unpackInt32(this.subArray(chunk, 8, 4)),
			uncompressedLength: this.unpackInt32(this.subArray(chunk, 12, 4)),
			baseRev: this.unpackInt32(this.subArray(chunk, 16, 4)),
			linkRev: this.unpackInt32(this.subArray(chunk, 20, 4)),
			parent1Rev: this.unpackInt32(this.subArray(chunk, 24, 4)),
			parent2Rev: this.unpackInt32(this.subArray(chunk, 28, 4)),
			nodeId: this.unpackSha(this.subArray(chunk, 32, 20))
		};
	}

	// Data

	readCommit(sha) {

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