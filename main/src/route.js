import ZeroFrame from "./libs/ZeroFrame.js";
const zf = new ZeroFrame();

import ZeroPage from "zero-dev-lib/ZeroPage";
const zp = new ZeroPage(zf);

import ZeroDB from "zero-dev-lib/ZeroDB";
const zeroDB = new ZeroDB(zp);

import Vue from "vue/dist/vue.min.js";
import VueRouter from "./libs/vuerouter.js";
const router = VueRouter(zp);
Vue.use(router.plugin);

import Routes from "./router_pages/routes.js";
export const route = vue => {
	const routes = Routes(vue);

	routes.forEach(route => router.router.add(route.path, route.controller));
	router.router.check(router.router.getURL());
};

export {zp as zeroPage, zeroDB};