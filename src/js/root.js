if(!window.zeroPage) {
	zeroFrame = new ZeroFrame();
	zeroPage = new ZeroPage(zeroFrame);
}

((self) => {
	// To those who don't understand why timeout is used here:
	//
	// ZeroNet changes title when it receives `setSiteInfo` event. And in many other
	// situations. I don't want to catch them, really, I tried and that was *much*
	// code. So please don't touch this *working* code!

	let currentTitle = null;

	function setTitle(title) {
		// Join " - Git Center" to title
		title = title ? title + " - Git Center" : "Git Center";

		// Exit on exact title because otherwise we will be left with two timeouts
		// setting one title
		if(currentTitle === title) {
			return;
		}

		currentTitle = title;
		updateTitle(title);
	}

	function updateTitle(title) {
		// Check if title is the same as we set, if it was changed, then another timeout
		// was just ran
		if(currentTitle === title) {
			zeroPage.cmd("wrapperSetTitle", [title]);

			// Change title every second
			setTimeout(() => updateTitle(title), 1000);
		}
	}

	self.setTitle = setTitle;
})(this);