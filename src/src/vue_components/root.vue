<template>
	<component :is="header" />
</template>

<script>
	var Router = require("../libs/router");

	module.exports = {
		props: [],
		name: "home",
		data: {
			header: require("./header/header.vue")
		}
	};
</script>