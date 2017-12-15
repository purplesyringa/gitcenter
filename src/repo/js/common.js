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
	let arrow = String.fromCharCode(8250);

	let name = document.getElementById("repo_name");
	name.textContent = title;
	repo.getOwner()
		.then(owner => {
			name.textContent = owner + " " + arrow + " " + title;
		});
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

	let starButton = document.getElementById("star");
	repo.isInIndex()
		.then(inIndex => {
			if(!inIndex) {
				return Promise.reject();
			}

			return repo.getStars();
		})
		.then(res => {
			starButton.style.display = "inline-block";
			starButton.innerHTML = (res.starred ? "Unstar" : "Star") + " (" + res.count + ")";
			starButton.onclick = () => {
				repo.star()
					.then(res => {
						starButton.innerHTML = (res.starred ? "Unstar" : "Star") + " (" + res.count + ")";
					});
			};
		})
		.catch(() => {}); // Who cares?

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

function showAction(action, context) {
	if(action.action) {
		let node = document.createElement("div");
		node.className = "action";
		node.innerHTML = repo.parseAction(action, context);

		document.getElementById("comments").appendChild(node);
	} else {
		let comment = action;

		let node = document.createElement("div");
		node.className = "comment" + (json == comment.json ? " comment-owned" : "");

		let header = document.createElement("div");
		header.className = "comment-header";
		header.textContent = comment.cert_user_id + " " + (comment.id == -1 ? "posted " + context : "commented") + " " + repo.translateDate(comment.date_added);
		node.appendChild(header);

		if(comment.owned) {
			let textarea = document.createElement("textarea");
			textarea.className = "comment-textarea";
			textarea.style.display = "none";
			node.appendChild(textarea);

			let edit = document.createElement("div");
			edit.className = "comment-edit";
			edit.onclick = () => {
				content.style.display = "none";
				edit.style.display = "none";
				remove.style.display = "none";

				textarea.style.display = "";
				save.style.display = "";

				textarea.value = comment.originalBody;
				textarea.focus();
			};
			header.appendChild(edit);

			let remove = document.createElement("div");
			remove.className = "comment-remove";
			remove.onclick = () => {
				zeroPage.confirm("Remove " + context + (comment.id == -1 ? "" : " comment") + "?")
					.then(() => {
						node.disabled = true;

						let funcName = {
							"issue": "removeIssue",
							"pull request": "removePullRequest"
						}[context];

						let parentId = {
							"issue": comment.issue_id,
							"pull request": comment.pull_request_id
						}[context];

						return repo[funcName + (comment.id == -1 ? "" : "Comment")](comment.id == -1 ? parentId : comment.id, comment.json);
					})
					.then(() => {
						if(comment.id == -1) {
							location.href = "../?" + address;
						} else {
							node.style.display = "none";
						}
					});
			};
			header.appendChild(remove);

			let save = document.createElement("div");
			save.className = "comment-save";
			save.style.display = "none";
			save.onclick = () => {
				textarea.disabled = true;

				let funcName = {
					"issue": "changeIssue",
					"pull request": "changePullRequest"
				}[context];

				let parentId = {
					"issue": comment.issue_id,
					"pull request": comment.pull_request_id
				}[context];

				repo[funcName + (comment.id == -1 ? "" : "Comment")](comment.id == -1 ? parentId : comment.id, comment.json, textarea.value)
					.then(() => {
						textarea.disabled = false;
						content.innerHTML = repo.renderMarked(textarea.value);

						content.style.display = "";
						edit.style.display = "";
						remove.style.display = "";

						textarea.style.display = "none";
						save.style.display = "none";
					});
			};
			header.appendChild(save);
		}

		let content = document.createElement("div");
		content.className = "comment-content";
		content.innerHTML = comment.body;
		node.appendChild(content);

		document.getElementById("comments").appendChild(node);
	}
}