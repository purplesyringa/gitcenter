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

		document.getElementById("maintainers_remove").onclick = () => {
			zeroPage.confirm("Remove <b>" + select.value + "</b> from maintainers?", "Yes")
				.then(() => {
					return repo.removeMaintainer(select.value);
				})
				.then(() => {
					let option = Array.prototype.slice.call(select.children).find(option => option.value == select.value);
					select.removeChild(option);
				});
		};
	});