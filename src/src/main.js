version = "0.1"

var ZeroFrame = require("./libs/ZeroFrame.js");
var Router = require("./libs/router.js");

var Vue = require("vue/dist/vue.min.js");

var app = new Vue({
	el: "#app",
	template: `<div>
		<component :is="root" />
	</div>`,
	data: {
		root: require("./vue_components/root.vue")
	}
});

var Home = require("./router_pages/home.vue");