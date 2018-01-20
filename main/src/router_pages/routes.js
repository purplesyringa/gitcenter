import Home from "./home/home.vue";
import Guide from "./guide/guide.vue";

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
	}
];