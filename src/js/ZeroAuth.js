class ZeroAuth {
	constructor(page, acceptedDomains) {
		if(typeof page != "object" || !page instanceof ZeroPage) {
			throw new Error("page should be an instance of ZeroPage");
		}
		this.page = page;

		if(acceptedDomains) {
			if(typeof acceptedDomains != "object" || !acceptedDomains instanceof Array) {
				throw new Error("acceptedDomains should be an instance of Array");
			}
			this.acceptedDomains = acceptedDomains;
		} else {
			this.acceptedDomains = ["zeroid.bit"];
		}

		this.activeAuth = null;
		this.page.cmd("siteInfo").then(siteInfo => {
			if(siteInfo.cert_user_id) {
				this.activeAuth = {
					user: siteInfo.cert_user_id,
					address: siteInfo.auth_address
				};
			}
		});
	}

	getAuth() {
		return this.activeAuth;
	}

	getAuthAsync() {
		return this.page.getSiteInfo()
			.then(siteInfo => {
				if(siteInfo.cert_user_id) {
					return {
						user: siteInfo.cert_user_id,
						address: siteInfo.auth_address
					};
				} else {
					return null;
				}
			});
	}

	requestAuth() {
		if(this.activeAuth !== null && this.activeAuth !== undefined) {
			return Promise.resolve(this.activeAuth);
		} else {
			return new Promise((resolve, reject) => {
				this.page.once("setSiteInfo", () => {
					ZeroPage.async.setTimeout(200)
						.then(() => {
							return this.page.getSiteInfo();
						}).then(siteInfo => {
							if(siteInfo.cert_user_id !== null && siteInfo.cert_user_id !== undefined) {
								this.activeAuth = {
									user: siteInfo.cert_user_id,
									address: siteInfo.auth_address
								};

								resolve(this.activeAuth);
							} else {
								this.activeAuth = null;

								reject("User rejected to authorizate");
							}
						});
				});

				this.page.cmd("certSelect", {
					accepted_domains: this.acceptedDomains
				});
			});
		}
	}

	isValidAddress(address) {
		return address.indexOf("@") != -1 && // has @
		       address.indexOf("@", address.indexOf("@") + 1) == -1; // only one @
	}
	addressToFilename(address) {
		if(!this.isValidAddress(address)) return "";

		return address.replace(/^(.*)@(.*)/, "[$1]$2");
	}
};