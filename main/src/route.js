import ZeroFrame from "./libs/ZeroFrame.js";
const zf = new ZeroFrame();

import Vue from "vue/dist/vue.min.js";
import VueRouter from "./libs/vuerouter.js";
Vue.use(VueRouter(zf));

import Home from "./router_pages/home/home.vue";

export const route = vue => {
	vue.currentView = Home;
};