(() => {
	let cloneRules = {
		Function: {
			from: func => {
				return func.toString();
			},
			to: code => {
				return eval("(" + code + ")");
			}
		},
		Response: {
			from: response => {
				return response.blob()
					.then(blob => {
						return {
							headers: cloneRules.Headers.from(response.headers),
							status: response.status,
							statusText: response.statusText,
							blob: blob
						};
					});
			},
			to: json => {
				return new Response(json.blob, {
					status: json.status,
					statusText: json.statusText,
					headers: cloneRules.Headers.to(json.headers)
				});
			}
		},
		Headers: {
			from: headers => {
				return Array.from(headers.entries());
			},
			to: entries => {
				let headers = new Headers();
				entries.forEach(entry => {
					headers.append(entry[0], entry[1]);
				});
				return headers;
			}
		}
	};

	let worker = () => {
		CLONE_RULES;

		let __self__ = this;

		onmessage = e => {
			if(e.data.action == "call") {
				try {
					let result = eval(e.data.func).apply(eval(e.data.root), e.data.args.map(arg => {
						if(typeof arg == "string" && arg.indexOf("__self__") == 0) {
							return eval(arg);
						} else {
							return arg;
						}
					}));

					if(!(result instanceof Promise)) {
						result = Promise.resolve(result);
					}

					result
						.then(result => {
							let type = toString.call(result).match(/^\[object (.*)\]$/)[1];

							let promise;

							if(cloneRules[type]) {
								promise = Promise.resolve()
									.then(() => cloneRules[type].from(result))
									.then(converted => {
										postMessage({
											id: e.data.id,
											result: converted,
											type: type
										});
									});
							} else {
								promise = Promise.resolve()
									.then(() => {
										postMessage({
											id: e.data.id,
											result: result
										});
									});
							}

							return promise;
						})
						.catch(err => {
							postMessage({
								id: e.data.id,
								error: err.toString()
							});
						});
				} catch(err) {
					postMessage({
						id: e.data.id,
						error: err.toString()
					});
				}
			} else if(e.data.action == "exec") {
				try {
					postMessage({
						id: e.data.id,
						result: eval(e.data.code)
					});
				} catch(err) {
					postMessage({
						id: e.data.id,
						error: err.toString()
					});
				}
			} else if(e.data.action == "set") {
				try {
					eval(e.data.root)[e.data.name] = e.data.value;

					postMessage({
						id: e.data.id,
						result: true
					});
				} catch(err) {
					postMessage({
						id: e.data.id,
						error: err.toString()
					});
				}
			} else if(e.data.action == "pass") {
				try {
					eval(e.data.root)[e.data.name] = cloneRules[e.data.type].to(e.data.value);

					postMessage({
						id: e.data.id,
						result: true
					});
				} catch(err) {
					postMessage({
						id: e.data.id,
						error: err.toString()
					});
				}
			} else {
				postMessage({
					id: e.data.id,
					error: "Wrong command"
				});
			}
		};
	};

	class WorkerOut {
		constructor() {
			this.id = 0;
			this.waiting = {};

			let cloneRulesParsed = "let cloneRules = {};\n";
			Object.keys(cloneRules).forEach(name => {
				cloneRulesParsed += "cloneRules." + name + " = {from: " + cloneRules[name].from.toString() + ", to: " + cloneRules[name].to.toString() + "};\n";
			});

			this.url = URL.createObjectURL(new Blob(["(" + worker.toString().replace("CLONE_RULES;", cloneRulesParsed) + ")();"], {type: "text/javascript"}));
			this.worker = new Worker(this.url);
			this.worker.onmessage = this.onmessage.bind(this);
			return new WorkerOutProxy(this, window, "");
		}

		onmessage(e) {
			if(!this.waiting[e.data.id]) {
				return;
			}

			if(e.data.error) {
				this.waiting[e.data.id].reject(e.data.error);
			} else if(e.data.type) {
				this.waiting[e.data.id].resolve(cloneRules[e.data.type].to(e.data.result));
			} else {
				this.waiting[e.data.id].resolve(e.data.result);
			}
		}

		postMessage(message) {
			message.id = this.id++;
			this.worker.postMessage(message);
			return new Promise((resolve, reject) => {
				this.waiting[message.id] = {
					resolve: resolve,
					reject: reject
				};
			});
		}
	};

	class WorkerOutProxy {
		constructor(worker, alternative, root) {
			this.worker = worker;
			this.alternative = alternative;
			this.additional = {};
			this.root = root;

			return new Proxy(this._call.bind(this), {
				getOwnPropertyDescriptor: this._getOwnPropertyDescriptor.bind(this),
				ownKeys: this._ownKeys.bind(this),
				defineProperty: this._defineProperty.bind(this),
				deleteProperty: this._deleteProperty.bind(this),
				preventExtensions: this._preventExtensions.bind(this),
				has: this._has.bind(this),
				get: this._get.bind(this),
				set: this._set.bind(this)
			});
		}

		_call(func, ...args) {
			if(typeof func != "function") {
				throw new TypeError(func + " is not a function");
			}

			return this.callFunction("(" + func.toString() + ")", "", ...args);
		}
		_getOwnPropertyDescriptor(target, name) {
			return Object.getOwnPropertyDescriptor(this.additional, name) || Object.getOwnPropertyDescriptor(this.alternative, name);
		}
		_ownKeys(target) {
			return Object.keys(this.alternative).concat(Object.keys(this.additional)).filter((obj, i, arr) => arr.indexOf(obj) == i);
		}
		_defineProperty(target, name, propertyDescriptor) {
			this.callFunction("Object.defineProperty", "Object", "__self__", name, propertyDescriptor);
			Object.defineProperty(this.additional, name, propertyDescriptor);
		}
		_deleteProperty(target, name) {
			this.exec("delete __self__[" + JSON.stringify(name) + "];");
			delete this.additional[name];
		}
		_preventExtensions(target) {
		}
		_has(target, name) {
			return name in this.additional || name in this.alternative;
		}
		_get(target, name, reciever) {
			if(typeof this.additional[name] == "function" || typeof this.alternative[name] == "function") {
				return (...args) => {
					return this.callFunction("__self__[" + JSON.stringify(name) + "]", "__self__", ...args);
				};
			} else if(
				(typeof this.additional[name] != "object" && this.additional[name] !== null) &&
				(typeof this.alternative[name] != "object" && this.alternative[name] !== null)
			) {
				return this.additional[name] === undefined ? this.alternative[name] : this.additional[name];
			} else {
				return new WorkerOutProxy(this.worker, this.additional[name] || this.alternative[name], this.root + "[" + JSON.stringify(name) + "]");
			}
		}
		_set(target, name, value, reciever) {
			this.recursiveSet("", name, value);
			this.additional[name] = value;
		}

		callFunction(func, root, ...args) {
			return Promise.all(
				args.map((arg, i) => {
					if(arg == "__self__") {
						return "__self__" + this.root;
					} else {
						return this.recursiveSet("", "__arg_" + i + "__", arg)
							.then(() => "__self__" + this.root + ".__arg_" + i + "__");
					}
				})
			).then(args => {
				return this.worker.postMessage({
					action: "call",
					func: func.replace(/__self__/g, "__self__" + this.root),
					root: root.replace(/__self__/g, "__self__" + this.root),
					args: args
				});
			});
		}
		exec(code) {
			return this.worker.postMessage({
				action: "exec",
				code: code.replace(/__self__/g, "__self__" + this.root)
			});
		}

		recursiveSet(root, name, value) {
			if((typeof value == "object" && value !== null) || typeof value == "function") {
				let type = toString.call(value).match(/^\[object (.*)\]$/)[1];

				if(cloneRules[type]) {
					return Promise.resolve()
						.then(() => cloneRules[type].from(value))
						.then(converted => {
							return this.pass(root, name, converted, type);
						});
				} else {
					if(value instanceof Array) {
						let newArr = [];
						value.forEach((item, i) => {
							if((typeof item != "object" || item === null) && typeof item != "function") {
								newArr[i] = item;
							}
						});

						return this.set(root, name, newArr)
							.then(() => {
								return Promise.all(
									value
										.map((item, i) => {
											if((typeof item == "object" && item !== null) || typeof item == "function") {
												return this.recursiveSet(root + "[" + JSON.stringify(name) + "]", i, item);
											}
										})
								);
							});
					} else {
						let newObject = {};
						Object.keys(value).forEach(key => {
							if((typeof value[key] != "object" || value[key] === null) && typeof value[key] != "function") {
								newObject[key] = value[key];
							}
						});

						return this.set(root, name, newObject)
							.then(() => {
								return Promise.all(
									Object.keys(value)
										.filter(childName => (typeof value[childName] == "object" && value[childName] !== null) || typeof value[childName] == "function")
										.map(childName => {
											return this.recursiveSet(root + "[" + JSON.stringify(name) + "]", childName, value[childName]);
										})
								);
							});
					}
				}
			} else {
				return this.set(root, name, value);
			}
		}
		set(root, name, value) {
			return this.worker.postMessage({
				action: "set",
				root: "__self__" + this.root + root,
				name: name,
				value: value
			});
		}
		pass(root, name, value, type) {
			return this.worker.postMessage({
				action: "pass",
				root: "__self__" + this.root + root,
				name: name,
				value: value,
				type: type
			});
		}
	};

	window.WorkerOut = WorkerOut;
})();