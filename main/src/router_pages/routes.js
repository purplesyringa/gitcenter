import Home from "./home/home.vue";

export default vue => [
	{
		path: "",
		controller: () => {
			console.log("/");
			vue.currentView = Home;
		}
	}
];