version = "0.1"

var ZeroFrame = require("./libs/ZeroFrame.js");
var Router = require("./libs/router.js");

var Vue = require("vue/dist/vue.min.js");

var VueZeroFrameRouter = require("./libs/vue-zeroframe-router.js");

Vue.use(VueZeroFrameRouter.VueZeroFrameRouter);

var app = new Vue({
	el: "#app",
	template: `<div>
			<component ref="view" :is="currentView"></component>
		</div>`,
	data: {
		currentView: null,
		userInfo: null,
		siteInfo: null
	}
});

var Home = require("./router_pages/home.vue");

VueZeroFrameRouter.VueZeroFrameRouter_Init(Router, app, [
	{ route: "", component: Home }
]);
