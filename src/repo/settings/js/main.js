if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

let indexation;
function showIndexation() {
	let index = document.getElementById("indexation_index");

	document.getElementById("description").classList.toggle("input-disabled", indexation);
	document.getElementById("description_save").classList.toggle("input-disabled", indexation);

	index.classList.toggle("button-disabled", indexation & 2);
	index.innerHTML = indexation & 2 ? "The repository was published to Repository Index" : "Publish to Repository Index";
}

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		if(!content.installed) {
			location.href = "../../install/?" + address;
		}

		showTitle(content.title);
		showHeader(1, content.git);
		showTabs(1);

		// Hooks
		let hooksSelect = document.getElementById("hooks_select");
		hooksSelect.value = content.hooks ? "enabled" : "disabled";

		hooksSelect.onchange = () => {
			if(hooksSelect.classList.contains("select-disabled")) {
				return;
			}
			hooksSelect.classList.add("select-disabled");

			repo.changeHooks(hooksSelect.value == "enabled")
				.then(() => {
					hooksSelect.classList.remove("select-disabled");
				}, e => {
					zeroPage.error(e);
					hooksSelect.classList.remove("select-disabled");
				});
		};

		// Description
		let input = document.getElementById("description");
		let button = document.getElementById("description_save");

		input.value = content.description;
		button.onclick = () => {
			if(button.classList.contains("button-disabled")) {
				return;
			}

			button.classList.add("button-disabled");
			repo.changeDescription(input.value)
				.then(() => {
					button.classList.remove("button-disabled");
				}, () => {
					button.classList.remove("button-disabled");
				});
		};

		// Load indexation
		return repo.isInIndex();
	})
	.then(i => {
		indexation = i;
		showIndexation();

		let index = document.getElementById("indexation_index");
		index.onclick = () => {
			if(index.classList.contains("button-disabled"))  {
				return;
			}

			if(!(indexation & 2)) {
				index.classList.add("button-disabled");

				repo.addToIndex()
					.then(() => {
						indexation |= 2;
						showIndexation();
					});
			}
		};

		return repo.getMaintainers();
	})
	.then(maintainers => {
		let select = document.getElementById("maintainers_select");
		select.innerHTML = "";
		maintainers.forEach(maintainer => {
			let option = document.createElement("option");
			option.textContent = maintainer.name + "@zeroid.bit";
			select.appendChild(option);
		});

		select.onchange = () => {
			document.getElementById("maintainers_remove").classList.remove("button-disabled");
		};

		let removeButton = document.getElementById("maintainers_remove");
		removeButton.onclick = () => {
			if(removeButton.classList.contains("button-disabled")) {
				return;
			}
			if(!select.value) {
				return;
			}

			zeroPage.confirm("Remove <b>" + select.value + "</b> from maintainers?", "Yes")
				.then(() => {
					removeButton.classList.add("button-disabled");
					return repo.removeMaintainer(select.value.replace(/@.*/, ""));
				})
				.then(() => {
					let option = Array.prototype.slice.call(select.children).find(option => option.value == select.value);
					select.removeChild(option);
					removeButton.classList.remove("button-disabled");
				}, () => {
					removeButton.classList.remove("button-disabled");
				});
		};

		let addButton = document.getElementById("maintainers_add");
		addButton.onclick = () => {
			if(addButton.classList.contains("button-disabled")) {
				return;
			}

			let name;
			zeroPage.prompt("What ZeroID to add?")
				.then(n => {
					name = n.replace(/@.*/, "");

					if(!name) {
						return;
					}

					addButton.classList.add("button-disabled");
					return repo.addMaintainer(name);
				})
				.then(() => {
					let option = document.createElement("option");
					option.textContent = name + "@zeroid.bit";
					select.appendChild(option);

					addButton.classList.remove("button-disabled");
				}, () => {
					addButton.classList.remove("button-disabled");
				});
		};

		let restoreButton = document.getElementById("maintainers_restore");
		restoreButton.onclick = () => {
			let auth;
			zeroPage.confirm("Do you want to run Restore Access procedure?<br>This way you can restore access if you have the private key of the site.<br>Otherwise, please ask other maintainers to do that.")
				.then(() => {
					return zeroAuth.requestAuth();
				})
				.then(a => {
					auth = a;
					restoreButton.classList.add("button-disabled");

					return repo.addMaintainer(auth.user.replace(/@.*/, ""), "site");
				})
				.then(() => {
					let option = document.createElement("option");
					option.textContent = auth.user;
					select.appendChild(option);

					restoreButton.classList.remove("button-disabled");
				}, error => {
					zeroPage.error("Failed to change maintainers. Please stop ZeroNet and manually add private key to users.json.<br>" + error);
					restoreButton.classList.remove("button-disabled");
				});
		};
	});