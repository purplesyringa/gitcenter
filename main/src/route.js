import ZeroFrame from "./libs/ZeroFrame.js";
const zf = new ZeroFrame();

import Vue from "vue/dist/vue.min.js";
import VueRouter from "./libs/vuerouter.js";
const router = VueRouter(zf);
Vue.use(router.plugin);

import Home from "./router_pages/home/home.vue";

export const route = vue => {
	vue.currentView = Home;
};