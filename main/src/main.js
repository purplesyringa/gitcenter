import Header from "./vue_components/gc-header/header.vue";
Vue.component("gc-header", Header);

import Vue from "vue/dist/vue.min.js";
import root from "./vue_components/root.vue";
var app = new Vue({
	el: "#app",
	render: h => h(root),
	data: {
		currentView: null
	}
});

import {route} from "./route.js";
route(app);