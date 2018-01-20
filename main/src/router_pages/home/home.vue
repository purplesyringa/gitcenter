<template>
	<div>
		<h1>Welcome to Git Center!</h1>
		<p>
			<b>Git Center</b> is a decentralized hosting platform for Git repositories. We provide several collaboration features such as bug tracking for every project, and private and public repositories for free. Join us by creating a new repository.
		</p>
		<p>
			<b>Git Center</b> is built using ZeroNet, so its workflow quite differs from GitHub. If you have any questions, <a href="support/">ask us for support</a>.
		</p>
		<p>
			<br>
			<a class="button" href="?/guide" @click.prevent="$router.navigate('guide')">Beginner's Guide</a>
			<a class="button button-blue" @click="init">New repository</a>
		</p>

		<h2>Contributors</h2>
		<p>
			If I missed you, mail me <a href="/Mail.ZeroNetwork.bit/?to=gitcenter">here</a>.
		</p>
		<ul>
			<li>Krixano - contibutor, tester</li>
			<li>Binchan - contibutor, tester</li>
			<li>ixhb5a7vwvdgimjx - beta-testing</li>
			<li>affeali - domain</li>
		</ul>
	</div>
</template>

<script type="text/javascript">
	import Repository from "../../repo/repo.js";

	export default {
		name: "home",
		methods: {
			async init() {
				const zp = this.$zeroPage;

				const siteInfo = await zp.getSiteInfo();
				if(siteInfo.settings.permissions.indexOf("Merger:GitCenter") == -1) {
					await zp.cmd("wrapperPermissionAdd", ["Merger:GitCenter"]);
				}
				if(siteInfo.settings.permissions.indexOf("Cors:1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz") == -1) {
					await zp.cmd("corsPermission", ["1iD5ZQJMNXu43w1qLB8sfdHVKppVMduGz"]);
				}

				const list = await zp.cmd("mergerSiteList");
				if(!list["1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6"]) {
					await zp.cmd("mergerSiteAdd", ["1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6"]);
				}
				if(!list["1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL"]) {
					await zp.cmd("mergerSiteAdd", ["1iNDExENNBsfHc6SKmy1HaeasHhm3RPcL"]);
				}

				Repository.createRepo(zp);
			}
		}
	};
</script>