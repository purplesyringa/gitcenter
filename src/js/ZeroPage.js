class ZeroPage {
	constructor(frame) {
		if(typeof frame != "object" || !frame instanceof ZeroFrame) {
			throw new Error("frame should be an instance of ZeroFrame");
		}
		this.frame = frame;
		this.progressId = 0;

		this.savedPrivateKey = "";

		this.initEventListeners();
	}

	/********************************* Logging ********************************/
	logWith(type, args) {
		let msg = args.map(v => this.objectToString(v)).join("\n");

		this.cmd("wrapperNotification", [type, msg]);
	}
	log() {
		console.info.apply(console, Array.prototype.slice.call(arguments));
		this.logWith("info", Array.prototype.slice.call(arguments));
	}
	warn() {
		console.warn.apply(console, Array.prototype.slice.call(arguments));
		this.logWith("error", Array.prototype.slice.call(arguments));
	}
	error() {
		console.error.apply(console, Array.prototype.slice.call(arguments));
		this.logWith("error", Array.prototype.slice.call(arguments));
	}
	progress() {
		let id = "progress" + (this.progressId++);
		let msg;
		let percent = 0;
		let done = false;

		let obj = {
			setPercent: p => {
				if(done) return;

				percent = p;

				if(percent == 0) {
					this.cmd("wrapperProgress", [
						id, // ID
						msg, // message
						0.05 // percent
					]);
					this.cmd("wrapperProgress", [
						id, // ID
						msg, // message
						0 // percent
					]);
				} else {
					this.cmd("wrapperProgress", [
						id, // ID
						msg, // message
						percent // percent
					]);
				}
			},
			setMessage: (...args) => {
				if(done) return;

				msg = args.map(v => this.objectToString(v)).join("\n");

				this.cmd("wrapperProgress", [
					id, // ID
					msg, // message
					percent // percent
				]);
			},
			done: () => {
				if(done) return;
				
				obj.setPercent(100);
				done = true;
			}
		};

		obj.setMessage.apply(this, Array.prototype.slice.call(arguments));
		
		return obj;
	}
	prompt(msg, type) {
		msg = this.objectToString(msg);
		return this.cmd("wrapperPrompt", [msg, type || "text"]);
	}
	alert(msg) {
		msg = this.objectToString(msg);
		this.cmd("wrapperNotification", ["info", msg]);
	}
	confirm(msg, ok) {
		return this.cmd("wrapperConfirm", [msg, ok || "OK"]);
	}

	/******************************** Commands ********************************/
	cmd(cmd, params) {
		return new Promise((resolve, reject) => {
			this.frame.cmd(cmd, params || [], res => {
				if(arguments.length) {
					resolve(res);
				} else {
					resolve();
				}
			});
		});
	}

	/****************************** EventEmmiter ******************************/
	initEventListeners() {
		this.eventListeners = {
			on: {},
			once: {}
		};

		this.frame.onRequest = (cmd, msg) => {
			this.emit(cmd, msg);
		};
	}
	on(cmd, callback) {
		if(!this.eventListeners.on.hasOwnProperty(cmd)) {
			this.eventListeners.on[cmd] = [];
		}

		this.eventListeners.on[cmd].push(callback);
	}
	off(cmd, callback) {
		if(this.eventListeners.on.hasOwnProperty(cmd)) {
			if(this.eventListeners.on[cmd].indexOf(callback) != -1) {
				this.eventListeners.on[cmd].splice(this.eventListeners.on[cmd].indexOf(callback), 1);
			}
		}
		if(this.eventListeners.once.hasOwnProperty(cmd)) {
			if(this.eventListeners.once[cmd].indexOf(callback) != -1) {
				this.eventListeners.once[cmd].splice(this.eventListeners.once[cmd].indexOf(callback), 1);
			}
		}
	}
	once(cmd, callback) {
		if(!this.eventListeners.once.hasOwnProperty(cmd)) {
			this.eventListeners.once[cmd] = [];
		}

		if(arguments.length <= 1) {
			return new Promise((resolve, reject) => {
				this.eventListeners.once[cmd].push((...args) => {
					resolve(...args);
				});
			});
		} else {
			this.eventListeners.once[cmd].push(callback);
		}
	}
	emit(cmd, arg) {
		if(this.eventListeners.on.hasOwnProperty(cmd)) {
			this.eventListeners.on[cmd].forEach(v => {
				if(arguments.length >= 2) {
					v(arg);
				} else {
					v();
				}
			});
		}
		if(this.eventListeners.once.hasOwnProperty(cmd)) {
			this.eventListeners.once[cmd].forEach(v => {
				if(arguments.length >= 2) {
					v(arg);
				} else {
					v();
				}
			});
			this.eventListeners.once[cmd] = [];
		}
	}

	/****************************** Site control ******************************/
	getPrivateKey() {
		if(this.savedPrivateKey) {
			return Promise.resolve(this.savedPrivateKey);
		}

		return this.getSiteInfo()
			.then(siteInfo => {
				if(siteInfo.privatekey) {
					return "stored";
				}

				return this.prompt("Enter your private key:");
			}).then(privatekey => {
				this.savedPrivateKey = privatekey;
				return privatekey;
			});
	}
	sign(file) {
		file = file || "content.json";

		return this.getPrivateKey()
			.then(privatekey => {
				return this.cmd(
					"siteSign",
					[
						privatekey, // private key
						file // file to sign
					]
				);
			}).then(res => {
				if(res === "ok") {
					return Promise.resolve(file);
				} else {
					return Promise.reject(res);
				}
			});
	}
	publish(file) {
		file = file || "content.json";

		return this.getPrivateKey()
			.then(privatekey => {
				return this.cmd(
					"sitePublish",
					[
						privatekey, // private key
						file, // file to sign
						true // sign before publish
					]
				);
			}).then(res => {
				if(res === "ok") {
					return Promise.resolve(file);
				} else {
					return Promise.reject(res);
				}
			});
	}
	getSiteInfo() {
		return this.cmd("siteInfo");
	}
	getUser() {
		return this.getSiteInfo()
			.then(res => res.auth_address);
	}
	isSignable(file) {
		return this.getSiteInfo()
			.then(siteInfo => {
				if(siteInfo.privatekey) {
					return true;
				}

				return this.cmd("fileRules", [file])
					.then(fileRules => fileRules && fileRules.signers && fileRules.signers.indexOf(siteInfo.auth_address) > -1);
			});
	}

	/************************** Additional functions **************************/
	objectToString(v) {
		if(typeof v == "string") {
			return v;
		} else if(typeof v == "number") {
			return v.toString();
		} else if(typeof v == "undefined") {
			return "undefined";
		} else if(typeof v == "object") {
			if(v === null) {
				return "null";
			} else {
				let res;
				try {
					res = JSON.stringify(v, null, 4);
				} catch(e) {
					res = res.toString();
				}
				return res;
			}
		} else if(typeof v == "boolean") {
			return v ? "true" : "false";
		} else if(typeof v == "function") {
			return v.toString();
		} else {
			return "unknown";
		}
	}
	isFunctionCalledInside(search) { // Returns true if <search> function called function (that called isFunctionCalledInside)
		let caller = arguments.callee.caller;
		while(caller) {
			if(caller == selfFunc) {
				return true;
			}
			caller = caller.caller;
		}
		return false;
	}
};
ZeroPage.async = {
	setTimeout: time => {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, time);
		});
	},
	filter: (arr, f) => {
		return Promise.all(
				arr.map((elem, i) => {
					let v = f(elem, i, arr);
					if(v instanceof Promise) {
						return v;
					} else {
						return Promise.resolve(v);
					}
				})
			).then(result => { // Use the result of promises to call sync filter()
				return arr.filter((element, index) => {
					return result[index];
				});
			});
	},
	map: (arr, f) => {
		return Promise.all(
				arr.map((elem, i) => {
					let v = f(elem, i, arr);
					if(v instanceof Promise) {
						return v;
					} else {
						return Promise.resolve(v);
					}
				})
			).then(result => { // Use the result of promises to call sync map()
				return arr.map((element, index) => {
					return result[index];
				});
			});
	},
	forEach: (arr, f) => {
		return Promise.all(
				arr.map((elem, i) => {
					let v = f(elem, i, arr);
					if(v instanceof Promise) {
						return v;
					} else {
						return Promise.resolve(v);
					}
				})
			);
	},
	concat: (...input) => {
		return Promise.all(input)
			.then(output => {
				return output.reduce((arr, prev) => prev.concat(arr), []);
			});
	}
};