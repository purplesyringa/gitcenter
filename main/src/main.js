import "./sass/main.sass";
import "./sass/buttons.sass";

import Vue from "vue/dist/vue.min.js";
import Header from "./vue_components/gc-header/header.vue";
Vue.component("gc-header", Header);

import root from "./vue_components/root.vue";
var app = new Vue({
	el: "#app",
	render: h => h(root),
	data: {
		currentView: null,
		zeroPage: null
	}
});

import {route, zeroPage} from "./route.js";
route(app);

Vue.prototype.$zeroPage = zeroPage;