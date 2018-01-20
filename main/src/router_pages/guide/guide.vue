<template>
	<div>
		<h1>Beginner's Guide</h1>

		<p>
			Today you'll learn how to:
		</p>
		<ul>
			<li>Create and use a repo</li>
			<li>Use issues</li>
			<li>Configurate your repository</li>
		</ul>

		<hr>

		<h2>What is Git Center?</h2>
		<p>
			Git Center is a Git repository hosting and a collaboration system. Using <code>git</code> while completing this tutorial will be also helpful.
		</p>

		<hr>

		<h2>Creating a repo</h2>
		<p>
			Git Center repositories are just sites. To create a repo, press <a class="button button-blue">New repository</a> on the home page and accept cloning.
		</p>
		<p>
			After cloning you will be redirected back to Git Center and installation progress will begin. It can ask you to log in to ZeroID if you haven't done it yet. Installation usually doesn't take much time.
		</p>
		<p>
			Finally you will be redirected to your repo root on Git Center zite. (Remember to give others <i>http://127.0.0.1/your_repo_address</i> instead of <i>http://127.0.0.1/1GitLiXB6t5r8vuU2zC6a8GYj9ME6HMQ4t/repo/?your_repo_address</i> because that adds more flexibility and makes changing Git Center source code easier.)
		</p>

		<hr>

		<h2>git clone</h2>
		<p>
			To clone your repo, simply copy <code>git clone ...</code> link from repository home page (click <a class="button">Clone</a> button) and replace <code>$path_to_data</code> with ZeroNet's <code>data</code> directory. This works like cloning a local repo.
		</p>

		<hr>

		<h2>Fetching and publishing changes</h2>
		<ul>
			<li>
				<code>git fetch</code><br>
				There is nothing hard in <code>fetch</code>ing Git Center repositories. You can simply run <code>git fetch</code>.
			</li>
			<li>
				<code>git push</code><br>
				Git Center offers two ways of pushing. First, you can run <code>git push</code> and then press <a class="button button-blue">Sign &amp; Publish changes</a> on repository home page.<br>
				<br>
				Secondly, you can skip manually pressing button with hooks. If you enable hooks on repository <b>Settings</b> tab, Git Center will fetch repository for changes and sign &amp; publish repository for you.
				<ol>
					<li>Your user must have read/write permissions to access ZeroNet directory.</li>
					<li><code>zeronet.home</code> git variable must be set to absolute path.</li>
					<li>You must have python installed and available in PATH.</li>
				</ol>
				You can disable signing and publishing via <code>git push -o no-sign</code>, publishing via <code>git push -o no-publish</code> and fetching via <code>git push -o no-fetch</code>. Join these arguments by using <code>git push -o no-sign -o no-publish -o no-fetch</code>.
			</li>
		</ul>

		<hr>

		<h2>Indexation</h2>
		<p>
			Right now you can share your repository by giving your friend a link to it. Git Center offers another way. You can <b>index</b> your repo.
		</p>
		<ul>
			<li>
				First, open <b>Settings</b> tab.
			</li>
			<li>
				You'll see <a class="button">Publish to Repository Index</a>. You can press it to publish the repository. <i>Note that you cannot completely remove your repository from index after you have published it.</i>
			</li>
		</ul>

		<hr>

		<h2>Communication</h2>
		<p>
			To let people speak about some project, Git Center added support for issues. You can see them on <b>Issues</b> tab, create them by pressing <a class="button button-blue">New issue</a> and then comment it. Other people can post comments then.
		</p>
		<p>
			You can also have pull requests. If people fork your repository and then create a pull request with a reference to that fork you can accept these requests and merge them. To do that, press <a class="button">Import</a>, then run <code>git fetch</code> on your local repository, merge branch <code>pr-...-...</code> manually and then <code>git push</code>.
		</p>
	</div>
</template>

<script type="text/javascript">
	export default {
		name: "guide"
	};
</script>