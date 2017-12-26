if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

let indexation;
function showIndexation() {
	let index = document.getElementById("indexation_index");

	document.getElementById("description").classList.toggle("input-disabled", indexation);
	document.getElementById("description_save").classList.toggle("button-disabled", indexation);

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

		setTitle("Settings - " + content.title);

		showTitle(content.title);
		showHeader(1, content);
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

		// Mute
		return repo.getMuted();
	})
	.then(muted => {
		muted.forEach(muted => {
			let option = document.createElement("option");
			option.textContent = muted;
			document.getElementById("mute_select").appendChild(option);
		});
		document.getElementById("mute_select").onfocus = () => {
			muteRemove.classList.remove("button-disabled");
		};

		let muteRemove = document.getElementById("mute_remove");
		muteRemove.onclick = () => {
			if(muteRemove.classList.contains("button-disabled") || !document.getElementById("mute_select").value) {
				return;
			}

			muteRemove.classList.add("button-disabled");

			let addr = document.getElementById("mute_select").value;
			repo.unmute(addr)
				.then(() => {
					muteRemove.classList.remove("button-disabled");
					let option = Array.prototype.slice.call(document.getElementById("mute_select").options).find(option => {
						return option.value == addr;
					});
					option.parentNode.removeChild(option);
				}, e => {
					zeroPage.error(e);
					muteRemove.classList.remove("button-disabled");
				});
		};

		let muteAdd = document.getElementById("mute_add");
		muteAdd.onclick = () => {
			if(muteAdd.classList.contains("button-disabled")) {
				return;
			}

			muteAdd.classList.add("button-disabled");

			let addr;
			zeroPage.prompt("ZeroID:")
				.then(a => {
					addr = a;
					return repo.mute(addr.replace("@zeroid.bit", "") + "@zeroid.bit");
				})
				.then(() => {
					muteAdd.classList.remove("button-disabled");

					let option = document.createElement("option");
					option.textContent = addr.replace("@zeroid.bit", "") + "@zeroid.bit";
					document.getElementById("mute_select").appendChild(option);
				}, e => {
					zeroPage.error(e);
					muteAdd.classList.remove("button-disabled");
				});
		};
	});