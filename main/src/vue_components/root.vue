<template>
	<div>
		<gc-header />

		<div class="current-view">
			<component :is="currentView"></component>
		</div>
	</div>
</template>

<style type="text/css">
.current-view {
	display: block;
	width: 896px;
	margin: 0 calc(50% - 448px);
}
</style>

<script language="text/javascript">
	import Home from "../router_pages/home/home.vue";

	export default {
		props: [],
		name: "root",
		data: () => {
			return {
				currentView: Home
			};
		}
	};
</script>