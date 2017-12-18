function loadObjects(context, page, status) {
	let query = {
		issue: "{object}s.open = " + (status == "open" ? 1 : 0),
		pull_request: "{object}s.merged = " + (status == "open" ? 0 : 1)
	}[context];

	return repo.issues.getObjects(context, page, query)
		.then(objects => {
			showObjects(context, objects);
			showNavigation(context, objects, page, status);
			showFollowing();
		});
}


function showObjects(context, objects) {
	objects.objects.forEach(object => {
		let status = {
			issue: (object.open ? (object.reopened ? "reopened" : "open") : "closed"),
			pull_request: object.merged ? "merged" : "opened"
		}[context == "object" ? object.context : context];
		let cssContext = repo.issues.contexts[context].css;

		let tr = document.createElement("tr");
		tr.onclick = () => {
			location.href = "view/?" + address + "/" + object.id + "@" + object.json.replace("data/users/", "");
		};

		let content = document.createElement("td");

		let icon = document.createElement("div");
		icon.className = cssContext + "-icon " + cssContext + "-status-" + status;
		content.appendChild(icon);

		let title = document.createElement("div");
		title.className = cssContext + "-title";
		title.textContent = object.title;
		content.appendChild(title);

		let tags = document.createElement("div");
		tags.className = "tags";
		object.tags.forEach(tag => {
			let color = repo.tagToColor(tag);

			let node = document.createElement("div");
			node.className = "tag";
			node.textContent = tag;
			node.style.backgroundColor = color.background;
			node.style.color = color.foreground;
			tags.appendChild(node);
		});
		content.appendChild(tags);

		let info = document.createElement("div");
		info.textContent = "#" + object.id + "@" + object.json.replace("data/users/", "") + " opened " + repo.translateDate(object.date_added) + " by " + object.cert_user_id;
		info.className = cssContext + "s-bottom";
		content.appendChild(info);

		tr.appendChild(content);
		document.getElementById(context + "s").appendChild(tr);
	});
}

function showNavigation(context, objects, currentPage, status) {
	if(currentPage > 0) {
		let button = document.getElementById("navigation_back");
		button.classList.remove("button-disabled");
		button.href = "?" + address + "/" + status + "/" + + (currentPage - 1);
	}

	if(objects.nextPage) {
		let button = document.getElementById("navigation_next");
		button.classList.remove("button-disabled");
		button.href = "?" + address + "/" + status + "/" + (currentPage + 1);
	}

	let node = document.getElementById(context + "s_" + status);
	if(node) {
		node.classList.add("current");

		document.getElementById(context + "s_open").href = "?" + address + "/open";
		document.getElementById(context + "s_closed").href = "?" + address + "/closed";
	}
}

function showFollowing() {
	function updateFollowing(isFollowing) {
		document.getElementById("follow").innerHTML = isFollowing ? "Stop following" : "Follow issues and pull requests in newsfeed";
	}

	return repo.isFollowing()
		.then(isFollowing => {
			let followButton = document.getElementById("follow");
			updateFollowing(isFollowing);
			followButton.onclick = () => {
				if(isFollowing) {
					repo.unfollow()
						.then(() => {
							isFollowing = false;
							updateFollowing(isFollowing);
						});
				} else {
					repo.follow()
						.then(() => {
							isFollowing = true;
							updateFollowing(isFollowing);
						});
				}
			};
		});
}