function showTabs(level) {
	document.getElementById("code_link").href = (
		"../".repeat(level) +
		"?" + address
	);

	document.getElementById("issues_link").href = (
		"../".repeat(level) +
		"issues/" +
		"?" + address
	);

	document.getElementById("pull_requests_link").href = (
		"../".repeat(level) +
		"pull-requests/" +
		"?" + address
	);

	document.getElementById("log_link").href = (
		"../".repeat(level) +
		"log/" +
		"?" + address
	);

	document.getElementById("releases_link").href = (
		"../".repeat(level) +
		"releases/" +
		"?" + address
	);

	document.getElementById("settings_link").href = (
		"../".repeat(level) +
		"settings/" +
		"?" + address
	);

	repo.isSignable()
		.then(signable => {
			if(signable) {
				document.getElementById("settings_link").style.display = "inline-block";
			}
		});
}

function showTitle(title) {
	let name = document.getElementById("repo_name");
	name.textContent = title;
}
function showHeader(level, gitAddress) {
	document.getElementById("fork").onclick = () => {
		repo.fork();
	};

	let publish = document.getElementById("publish");
	repo.isSignable()
		.then(signable => {
			if(signable) {
				publish.style.display = "inline-block";
				publish.onclick = () => {
					if(publish.classList.contains("button-disabled")) {
						return;
					}

					publish.classList.add("button-disabled");

					repo.signContent("site")
						.catch(e => {
							zeroPage.error(e);
						})
						.then(() => {
							publish.classList.remove("button-disabled");
						});
				};
			}
		});

	document.getElementById("git_button").onclick = () => {
		let command = "git clone $path_to_data/" + address + "/" + gitAddress;
		if(copy(command)) {
			zeroPage.alert("<b>" + command + "</b> was copied to the clipboard.<br>Replace <b>$path_to_data</b> with correct path to ZeroNet's data folder.");
		} else {
			prompt("Command", command);
		}
	};
}

function showBranches(noPath) {
	return repo.getBranches()
		.then(list => {
			// Show branch list
			let branches = document.getElementById("branches");
			list.forEach(curBranch => {
				let plain = curBranch.replace(/^refs\/.*?\//, "");
				let option = document.createElement("div");
				option.className = "branch" + (plain == branch ? " branch-active" : "") + (curBranch.indexOf("refs/tags/") == 0 ? " tag" : "");
				option.textContent = plain;
				option.onclick = () => {
					location.href = "?" + address + "/" + (noPath ? plain : path.replace(/@/g, "@@") + "@" + plain.replace(/@/g, "@@"));
				};
				branches.appendChild(option);
			});
		});
}

function showPath(isCurrentFile, prefix) {
	// Show path
	document.getElementById("files_root").href = (isCurrentFile ? "../?" + address : "?" + address) + "@" + branch.replace(/@/g, "@@");

	let filesPath = document.getElementById("files_path");
	let parts = path.split("/").filter(part => part.length);
	parts.forEach((part, i) => {
		let node = document.createElement("span");
		node.textContent = !prefix && i == parts.length - 1 ? "" : " › ";

		let link = document.createElement(!prefix && i == parts.length - 1 ? "span" : "a");
		link.textContent = part;
		if(!isCurrentFile) {
			link.href = "?" + address + "/" + parts.slice(0, i + 1).join("/").replace(/@/g, "@@") + "@" + branch.replace(/@/g, "@@");
		} else if(prefix || i < parts.length - 1) {
			link.href = "../?" + address + "/" + parts.slice(0, i + 1).join("/").replace(/@/g, "@@") + "@" + branch.replace(/@/g, "@@");
		}
		node.insertBefore(link, node.firstChild);

		filesPath.appendChild(node);
	});
}

function copy(text) {
	let input = document.createElement("input");
	input.value = text;
	document.body.appendChild(input);
	input.select();
	try {
		document.execCommand("copy");
		document.body.removeChild(input);
		return true;
	} catch(e) {
		document.body.removeChild(input);
		return false;
	}
}

function showLinks() {
	if(repo.git.isSha(branch)) {
		document.getElementById("permanent_link").textContent = branch;

		document.getElementById("permanent_link").onclick = () => {
			let permanent = location.href.replace(/\?.*/, "") + "?" + address + "/" + path.replace(/@/g, "@@") + "@" + branch;
			if(copy(permanent)) {
				zeroPage.alert("Permanent link was copied to clipboard");
			} else {
				prompt("Permanent link", permanent);
			}
		};
	} else {
		repo.git.getBranchCommit(branch)
			.then(commit => {
				document.getElementById("permanent_link").onclick = () => {
					let permanent = location.href.replace(/\?.*/, "") + "?" + address + "/" + path.replace(/@/g, "@@") + "@" + commit;
					if(copy(permanent)) {
						zeroPage.alert("Permanent link was copied to clipboard");
					} else {
						prompt("Permanent link", permanent);
					}
				};
			});
	}
}