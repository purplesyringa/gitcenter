<style type="text/css" src="./header.css"></style>

<template>
	<header class="header">
		<a href="?/" @click.prevent="$router.navigate('')">
			<img src="img/logo-white.svg" class="header-logo">
			<div class="header-name">Git Center</div>
		</a>

		<template v-for="item in items">
			<a class="header-item" :href="'?/' + item.address" @click.prevent="$router.navigate(item.address)">{{item.name}}</a>
		</template>
	</header>
</template>

<script language="text/javascript">
	export default {
		name: "header",
		data: () => {
			return {
				items: [
					{name: "Repository Index", address: "index"},
					{name: "My Repos",         address: "myrepos"},
					{name: "Beginner's Guide", address: "guide"},
					{name: "Support",          address: "support"},
					{name: "Profile",          address: "profile"},
					{name: "For devs",         address: "for-devs"}
				]
			};
		}
	};
</script>