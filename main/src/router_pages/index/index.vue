<style lang="sass" src="./index.sass" scoped></style>

<template>
	<div>
		<h1>Repository Index</h1>
		<input type="text" class="search" placeholder="Search repository index..." v-model="search">

		<div class="hint">
			<b>a b c</b> matches <b>a</b> or <b>b</b> or <b>c</b><br>
			<b>+a +b +c</b> matches <b>a</b> and <b>b</b> and <b>c</b><br>
			<b>+a b c</b> matches <b>a</b> and (<b>b</b> or <b>c</b>)<br>
			<b>sort:date</b> sorts by publish date<br>
			<b>sort:stars</b> (default) sorts by star count<br>
			<b>sort:random</b> uses random order<br>
			<b>is:downloaded</b> shows only downloaded
		</div>

		<div>
			<repository
				v-for="repo in repos"
				:key="repo.address"

				:address="repo.address"
				:stars="repo.stars"
				:downloaded="repo.downloaded"
				:title="repo.title"
				:description="repo.description"
			/>
		</div>
	</div>
</template>

<script type="text/javascript">
	import {search} from "./index.js";

	export default {
		name: "index",
		data() {
			return {
				search: ""
			};
		},
		asyncComputed: {
			repos: {
				async get() {
					return await search(this.search);
				},
				default: []
			}
		}
	};
</script>