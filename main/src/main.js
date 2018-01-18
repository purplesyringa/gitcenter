import ZeroFrame from "./libs/ZeroFrame.js";
const zf = new ZeroFrame();

import Router from "./libs/router.js";
import VueRouter from "./libs/vuerouter.js";

import Vue from "vue/dist/vue.min.js";
Vue.use(VueRouter(zf));

import root from "./vue_components/root.vue";

import Header from "./vue_components/gc-header/header.vue";
Vue.component("gc-header", Header);

var app = new Vue({
	el: "#app",
	render: h => h(root)
});

import Home from "./router_pages/home.vue";