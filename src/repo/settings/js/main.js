repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		showTitle(content.title);
		showTabs(1);

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
					console.log(name);
					let option = document.createElement("option");
					option.textContent = name + "@zeroid.bit";
					select.appendChild(option);

					addButton.classList.remove("button-disabled");
				}, e => {
					addButton.classList.remove("button-disabled");
				});
		};
	});