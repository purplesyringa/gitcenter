module.exports = class Router {
	constructor(zeroPage) {
		this.routes = [];
		this.currentRoute = [];
		this.currentParams = {};
		this.zeroPage = zeroPage;

		this.check("");
	}

	getURL() {
		return this.clearSlashes(
			location.search
				.replace(/[?&]wrapper_nonce=([A-Za-z0-9]+)/, "")
				.replace("?/", "")
		);
	}
	clearSlashes(path) {
		return path.toString().replace(/\/$/, "").replace(/^\//, "");
	}

	add(path, controller) {
		this.routes.push({path, controller});
	}
	remove(arg) {
		let index = this.routes.findIndex(route => route.controller == arg || route.path == arg);
		if(index > -1) {
			this.routes.splice(index, 1);
		}
	}

	check(hash) {
		this.routes.forEach(route => {
			let match = hash
				.replace(/^\//, "")
				.match(
					new RegExp(
						"^" +
						route.path
							.replace(/:([^\/]+)/g, "([^\/]*)")
							.replace(/\*/g, '(?:.*)') +
						"(?:\/|$)"
					)
				);

			if(match) {
				match.shift(); // Shift [0] which has all the pattern

				let keys = route.path.match(/:([^\/]+)/g);
				let routeParams = {};
				match.forEach(value => {
					routeParams[keys[i].replace(":", "")] = value;
				});

				this.currentParams = routeParams;
				this.currentRoute = route.path;

				route.controller(routeParams);
			}
		});
	}

	refresh() {
		this.check(this.currentRoute);
	}

	listenForBack(cmd, message) {
		if(cmd == "wrapperPopState") {
			if(message.params.state) {
				if(!message.params.state.url) {
					message.params.state.url = message.params.href.replace(/.*\?/, "");
				}
				this.navigate(message.params.state.url.replace(/^\//, ""), false);
			}
		}
	}

	navigate(path, doPush=true) {
		path = path || "";

		let previousRoute = this.currentRoute;
		if(doPush) {
			this.zeroPage.cmd("wrapperPushState", [{route: path}, path, "/" + this.clearSlashes(path)])
		}

		this.check(path);
	}
};