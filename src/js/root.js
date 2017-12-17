if(!window.zeroPage) {
	zeroFrame = new ZeroFrame();
	zeroPage = new ZeroPage(zeroFrame);
}

((self) => {
	let currentTitle = null;

	function setTitle(title) {
		title = title ? title + " - Git Center" : "Git Center";

		if(currentTitle === title) {
			return;
		}

		currentTitle = title;
		updateTitle(title);
		setTimeout(() => updateTitle(title), 1000);
	}

	function updateTitle(title) {
		if(currentTitle === title) {
			zeroPage.cmd("wrapperSetTitle", [title]);
			setTimeout(() => updateTitle(title), 1000);
		}
	}

	self.setTitle = setTitle;
})(this);