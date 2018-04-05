if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

count = isNaN(parseInt(path)) ? 10 : parseInt(path);

let content;
repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(c => {
		content = c;

		if(!content.installed) {
			location.href = "../../install/?" + address;
		}

		if(!branch) {
			return repo.vcs.getHead()
				.then(head => branch = head);
		}
	})
	.then(() => {
		setTitle("Log - " + content.title);

		showTitle(content.title);
		showHeader(1, content);
		showTabs(1);
		showBranches();

		/*
		let template = {
			colors: ["#5EC4CD", "#9A6AD6", "#FFB800", "#FF9A40"],
			branch: {
				lineWidth: 8,
				lineDash: ["dotted"],
				spacingX: 32,
				labelRotation: 0,
				showLabel: true,
				mergeStyle: "bezier",
				labelFont: "normal 12px Verdana"
			},
			commit: {
				spacingY: -48,
				dot: {
					size: 8
				},
				tag: {
					font: "normal 12px Verdana"
				},
				message: {
					displayAuthor: true,
					displayBranch: false,
					displayHash: true,
					font: "normal 16px Verdana"
				},
				tooltipHTMLFormatter: commit => {
					return "[" + commit.sha1 + "] " + commit.message;
				}
			}
		};

		let graph = new GitGraph({
			template: new GitGraph.Template(template),
			orientation: "vertical-reverse",
			mode: "extended",
			elementId: "network"
		});
		*/

		document.getElementById("commit_count").value = count;
		document.getElementById("commit_count").onkeypress = e => {
			if(e.keyCode == 13) {
				location.href = "?" + address + "/" + document.getElementById("commit_count").value + "@" + branch.replace(/@/g, "@@");
			}
		};
		document.getElementById("commit_load").onclick = () => {
			location.href = "?" + address + "/" + document.getElementById("commit_count").value + "@" + branch.replace(/@/g, "@@");
		};

		return repo.getCommits(branch, count);
	})
	.then(commits => {
		document.getElementById("commits").innerHTML = "";

		commits.forEach(commit => {
			let node = document.createElement("div");
			node.className = "commit";

			let title = document.createElement("div");
			title.className = "commit-title";
			title.textContent = commit.content.message;
			node.appendChild(title);

			let description = document.createElement("div");
			description.className = "commit-description";

			let commitLink = document.createElement("a");
			commitLink.href = "../?" + address + "/@" + commit.id;
			commitLink.textContent = commit.id;
			description.appendChild(commitLink);

			description.appendChild(document.createTextNode(" "));

			let diffLink = document.createElement("a");
			diffLink.innerHTML = "[diff]";
			diffLink.href = "../commit/?" + address + "/" + commit.id;
			description.appendChild(diffLink);

			description.appendChild(document.createElement("br"));

			description.appendChild(document.createTextNode(repo.parseAuthor(commit.content.committer)));

			node.appendChild(description);

			document.getElementById("commits").appendChild(node);

			if(commit.content.parents.length > 1) {
				let note = document.createElement("div");
				note.className = "note";
				note.innerHTML = "Commits " + commit.content.parents.map(commit => commit.id).join(", ") + " were merged into " + commit.id;
				document.getElementById("commits").appendChild(note);
			}

			if(commit.content.delivered) {
				let note = document.createElement("div");
				note.className = "note";
				note.innerHTML = "Commit " + commit.id + " was likely delivered from " + commit.content.delivered.map(commit => commit.id).join(", ");
				document.getElementById("commits").appendChild(note);
			}
		});
	});