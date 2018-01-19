import Vue from "vue/dist/vue.min.js";
import Router from "./router.js";

export default zeroPage => {
	const router = new Router(zeroPage);

	const plugin = {
		router,
		install: () => {
			Object.defineProperty(Vue.prototype, "$router", {
				get: () => router
			})
		}
	};

	return {plugin, router};
};