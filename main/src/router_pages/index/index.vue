<style lang="sass" src="./index.sass" scoped />

<template>
	<div>
		<h1>Repository Index</h1>
		<input type="text" id="search" class="search" placeholder="Search repository index...">

		<div class="hint">
			<b>a b c</b> matches <b>a</b> or <b>b</b> or <b>c</b><br>
			<b>+a +b +c</b> matches <b>a</b> and <b>b</b> and <b>c</b><br>
			<b>+a b c</b> matches <b>a</b> and (<b>b</b> or <b>c</b>)<br>
			<b>sort:date</b> sorts by publish date<br>
			<b>sort:stars</b> (default) sorts by star count<br>
			<b>sort:random</b> uses random order<br>
			<b>is:downloaded</b> shows only downloaded
		</div>

		<div id="repos"></div>
	</div>
</template>

<script type="text/javascript">
	export default {
		name: "index"
	};
</script>