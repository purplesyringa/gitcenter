var Router = {
	routes: [],
	currentRoute: "",
	currentParams: {},
	root: "/",
	notFoundFunction: null,
	hookFunctions: {}, // hooks that are called for each route, functions for 'before' and 'after'.
	config: function(options) {
		this.root = options && options.root ? "/" + this.clearSlashes(options.root) + "/" : "/";
		return this;
	},
	getURL: function() { // get's current query string/hash & clears slashes from beginning and end, Note: only for initial load
		var url = '';
		url = window.location.search.replace(/&wrapper_nonce=([A-Za-z0-9]+)/, "").replace(/\?wrapper_nonce=([A-Za-z0-9]+)/, "").replace(/\?\//, ''); // TODO: Fix this to replace the root instead of just a slash
		console.log(url);
		return this.clearSlashes(url);
	},
	clearSlashes: function(path) {
		return path.toString().replace(/\/$/, '').replace(/^\//, '');
	},
	add: function(path, controller, hooks, object = null) {
		if (typeof path === "function") {
			object = hooks;
			hooks = controller;
			controller = path;
			path = '';
		}
		this.routes.push({ path: path, controller: controller, hooks: hooks, object: object });
		return this;
	},
	remove: function(param) {
		for (var i = 0, r; i < this.routes.length, r = this.routes[i]; i++) {
			if (r.controller === param || r.path.toString() === param.toString()) {
				this.routes.splice(i, 1);
				return this;
			}
		}
		return this;
	},
	flush: function() {
		this.routes = [];
		this.root = '/';
		return this;
	},
	check: function(hash) {
		var reg, keys, match, routeParams;
		for (var i = 0, max = this.routes.length; i < max; i++ ) {
			routeParams = {}
			keys = this.routes[i].path.match(/:([^\/]+)/g);
			match = hash.replace(/^\//, "").match(new RegExp("^" + this.routes[i].path.replace(/:([^\/]+)/g, "([^\/]*)").replace(/\*/g, '(?:.*)') + '(?:\/|$)'));
			if (match) {
				match.shift();
				match.forEach(function (value, i) {
					routeParams[keys[i].replace(":", "")] = value;
				});
				var object = {};
				if (this.routes[i].object) {
					object = this.routes[i].object;
					object.params = routeParams;
				}
				this.currentParams = routeParams;
				// Call 'before' hook
				if (this.hookFunctions && this.hookFunctions["before"]) { // TODO: Move this into navigate function?
					if (!this.hookFunctions["before"].call(object, this.routes[i].path, routeParams)) {
						page.cmd("wrapperPushState", [{ "route": this.currentRoute }, null, this.root + this.clearSlashes(this.currentRoute)]);
						return this;
					}
				}
				// Call route-specific 'before' hook
				if (this.routes[i].hooks && this.routes[i].hooks["before"]) {
					if (!this.routes[i].hooks["before"].call(object, routeParams)) {
						page.cmd("wrapperPushState", [{ "route": this.currentRoute }, null, this.root + this.clearSlashes(this.currentRoute)]);
						return this;
					}
				}
				this.currentRoute = this.routes[i].path;
				window.scroll(window.pageXOffset, 0);
				if (this.setView) { // Used for Vue-ZeroFrame-Router-Plugin NOTE: May Change
					this.setView(i, this.routes[i].object);
				}
				this.routes[i].controller.call(object, routeParams);
				// Call route-specific 'after' hook
				if (this.routes[i].hooks) {
					this.routes[i].hooks["after"].call(object, routeParams);
				}
				if (this.hookFunctions) {
					if (this.hookFunctions["after"]) {
						this.hookFunctions["after"].call(object, this.currentRoute, routeParams);
					}
				}
				return this;
			}
		}
		return this;
	},
	refresh: function() { // Refreshes the current route - reruns the route's controller function
		this.check(this.currentRoute);
		return this;
	},
	listenForBack: function(cmd, message) { // Note: Call in the OnRequest function in ZeroFrame class.
		if (!cmd) console.log("[Router] Please pass in cmd and message into Router.listenForBack function");
		if (cmd == "wrapperPopState") {
			if (message.params.state) {
				if (!message.params.state.url) {
					message.params.state.url = message.params.href.replace(/.*\?/, "");
				}
				this.navigate(message.params.state.url.replace(/^\//, ''), false);
			}
		}
	},
	navigate: function(path, doPush = true) {
		var previousRoute = this.currentRoute;
		// TODO: Call route-specific 'leave' hook
		// Call global 'leave' hook
		if (this.hookFunctions && this.hookFunctions["leave"]) {
			if (!this.hookFunctions["leave"].call({}, previousRoute)) {
				return this;
			}
		}

		path = path ? path : '';
		if (doPush == true) {
			page.cmd("wrapperPushState", [{ "route": path }, path, this.root + this.clearSlashes(path)]);
		}
		this.check(path);
		return this;
	},
	hooks: function(hookFunctions) { // TODO: Check if using correct format?
		this.hookFunctions = hookFunctions;
		return this;
	},
	notFound: function(f) {
		if (f && typeof f === "function") {
			this.notFoundFunction = f;
		}
		return this;
	}
}

// Note: Call right after creating all of your routes.
Router.init = function() {
	// if '?/' isn't on address - add it
	var address = window.location.search.replace(/&wrapper_nonce=([A-Za-z0-9]+)/, "").replace(/\?wrapper_nonce=([A-Za-z0-9]+)/, ""); // TODO: Fix this to replace the root instead of just a slash
	if (address == '') {
		page.cmd("wrapperPushState", [{ "route": "" }, null, this.root]);
	}
	// Resolve the initial route
	Router.check(Router.getURL());
}

// Returns a string with the html for a link that will call the Router.navigate function when clicked.
// Example:
//   content += generateRouteLinkHTML('tutorials/' + tutorial.slug, tutorial.name, 'button is-info', 'margin-left: 30px;') + "<br>";
function generateRouteLinkHTML(to, display, tagClass = "", tagStyle = "") {
	var link = '<a href="./?/' + to + '" onclick="Router.navigate(\'' + to + '\'); event.preventDefault();"';

	if (tagClass && tagClass !== "") {
		link += ' class="' + tagClass + '"';
	}
	if (tagStyle && tagStyle !== "") {
		link += ' style="' + tagStyle + '"';
	}
	link += '>' + display + '</a>';
	return link;
}

module.exports = Router;