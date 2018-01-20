import ZeroFrame from "./libs/ZeroFrame.js";
const zf = new ZeroFrame();

import ZeroPage from "zero-dev-lib/ZeroPage";
const zp = new ZeroPage(zf);

import Vue from "vue/dist/vue.min.js";
import VueRouter from "./libs/vuerouter.js";
const router = VueRouter(zp);
Vue.use(router.plugin);

import Home from "./router_pages/home/home.vue";

import Routes from "./router_pages/routes.js";
export const route = vue => {
	const routes = Routes(vue);

	vue.currentView = Home;
	routes.forEach(route => router.router.add(route.path, route.controller));
};

export {zp as zeroPage};