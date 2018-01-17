version = "0.1"

var ZeroFrame = require("./libs/ZeroFrame.js");
var Router = require("./libs/router.js");

var Vue = require("vue/dist/vue.min.js");

let root = require("./vue_components/root.vue");

const Header = require("./vue_components/gc-header/header.vue");
Vue.component("gc-header", Header);

var app = new Vue({
	el: "#app",
	render: h => h(root)
});

var Home = require("./router_pages/home.vue");