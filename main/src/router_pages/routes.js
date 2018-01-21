import Home from "./home/home.vue";
import Guide from "./guide/guide.vue";
import Index from "./index/index.vue";

export default vue => [
	{
		path: "",
		controller: () => {
			vue.currentView = Home;
		}
	},
	{
		path: "guide",
		controller: () => {
			vue.currentView = Guide;
		}
	},
	{
		path: "index",
		controller: () => {
			vue.currentView = Index;
		}
	}
];