<style lang="sass" src="./repository.sass" scoped></style>

<template>
	<a class="repo" :href="'/' + address">
		<div class="repo-stars">{{stars}}</div>
		<div class="repo-downloaded" v-if="downloaded" />

		<div class="repo-title">{{title}}</div>
		<div class="repo-address">
			{{address}}<br>
			{{description}}
		</div>
	</a>
</template>

<script type="text/javascript">
	export default {
		name: "repository",
		props: ["address", "stars", "downloaded", "title", "description"]
	};
</script>