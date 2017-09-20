repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		if(content.installed) {
			location.href = "../repo/?" + address;
		}

		return repo.install();
	})
	.then(() => {
		location.href = "../repo/?" + address;
	});