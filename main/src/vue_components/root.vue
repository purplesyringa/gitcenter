<template>
	<div>
		<gc-header />
		<component :is="currentView"></component>
	</div>
</template>

<script language="text/javascript">
	import Header from "./gc-header/header.vue";

	export default {
		props: [],
		name: "root",
		data: () => {
			return {
				currentView: Header
			};
		}
	};
</script>