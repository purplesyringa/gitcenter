if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

branch = additional;

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
			return repo.git.getHead()
				.then(head => branch = head);
		}
	})
	.then(() => {
		showTitle(content.title);
		showHeader(1);
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

		return repo.getCommits(branch, 10);
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

			let link = document.createElement("a");
			link.innerHTML = commit.id;
			link.href = "../?" + address + "/@" + commit.id;
			description.appendChild(link);

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