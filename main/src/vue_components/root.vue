<template>
	<div>
		<gc-header />

		<div class="current-view">
			<component :is="$parent.currentView"></component>
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
	export default {
		props: [],
		name: "root"
	};
</script>