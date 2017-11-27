class ZeroFS {
	constructor(page) {
		if(typeof page != "object" || !page instanceof ZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
		}
		this.page = page;
	}

	fileExists(file) {
		if(file == "") { // root
			return Promise.resolve(true); // the following check will fail for root
		}

		let dirPath = file.split("/").slice(0, -1).join("/");
		let basePath = file.split("/").pop();

		return this.readDirectory(dirPath)
			.then(children => {
				return Promise.resolve(children.indexOf(basePath) > -1);
			});
	}
	readFile(file, bytes, required) {
		return this.page.cmd("fileGet", [
			file, // file
			required, // required (wait until file exists)
			"base64", // text or base64
			300 // timeout
		]).then(res => {
			if(res === null || res === false) {
				return Promise.reject("File doesn't exist: " + file);
			} else {
				return Promise.resolve(this.fromBase64(res, bytes));
			}
		});
	}
	writeFile(file, content, bytes) {
		return this.page.cmd("fileWrite", [
			file, // file
			this.toBase64(content, bytes), // base64-encoded content
			true // ignore bad files
		]).then(res => {
			if(res === "ok") {
				return Promise.resolve(file);
			} else {
				return Promise.reject(res);
			}
		});
	}
	deleteFile(file) {
		return this.page.cmd("fileDelete", [
			file // file
		]).then(res => {
			if(res === "ok") {
				return Promise.resolve(file);
			} else {
				return Promise.reject(res);
			}
		});
	}

	readDirectory(dir, recursive) {
		return this.page.cmd("fileList", [
			dir, // directory
		]).then(res => {
			if(recursive) {
				return res.sort(); // If recursive, return as given
			} else {
				return res.map(file => { // Otherwise, crop by "/" symbol
					if(file.indexOf("/") == -1) {
						return file;
					} else {
						return file.substr(0, file.indexOf("/"));
					}
				}).reduce((arr, cur) => { // And make them unique
					return arr.indexOf(cur) > -1 ? arr : arr.concat(cur);
				}, []).sort();
			}
		});
	}

	getType(file) {
		if(file == "") {
			return Promise.resolve("dir");
		}

		let dir = file.split("/");
		let relative = dir.pop();
		dir = dir.join("/");

		return this.page.cmd("fileList", [
			dir, // directory
		]).then(res => {
			res = res.map(file => { // Crop by "/" symbol
				if(file.indexOf("/") == -1) {
					return file;
				} else {
					return file.substr(0, file.indexOf("/")) + "/";
				}
			});

			if(res.indexOf(relative) > -1) {
				return "file";
			} else if(res.indexOf(relative + "/") > -1) {
				return "dir";
			} else {
				return Promise.reject("File doesn't exist: " + file);
			}
		});
	}

	toBase64(str, bytes) {
		return btoa(bytes ? str : unescape(encodeURIComponent(str)));
	}
	fromBase64(str, bytes) {
		if(bytes == "arraybuffer") {
			let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

			let resultingSize = str.length / 4 * 3;
			str = str.replace(/=+$/g, "");

			let result = new Uint8Array(resultingSize);
			let strPos = 0;

			for(let i = 0; i < resultingSize;) {
				let part1 = chars.indexOf(str.charAt(strPos++));
				let part2 = chars.indexOf(str.charAt(strPos++));
				let part3 = chars.indexOf(str.charAt(strPos++));
				let part4 = chars.indexOf(str.charAt(strPos++));

				let res1 = (part1 << 2) | (part2 >> 4);
				let res2 = ((part2 & 15) << 4) | (part3 >> 2);
				let res3 = ((part3 & 3) << 6) | part4;

				result[i++] = res1;
				if(part3 != -1) {
					result[i++] = res2;
				}
				if(part4 != -1) {
					result[i++] = res3;
				}
			}

			return result;
		} else {
			let text = bytes ? atob(str) : decodeURIComponent(escape(atob(str)));
			return text;
		}
	}
}