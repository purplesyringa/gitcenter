zeroFrame = new ZeroFrame();
zeroPage = new ZeroPage(zeroFrame);
zeroAuth = new ZeroAuth(zeroPage);

let address = location.search.replace(/[?&]wrapper_nonce=.*/, "").replace("?", "");
if(!address) {
	location.href = "..";
}

let additional = "";
if(address.indexOf("/") > -1) {
	additional = decodeURIComponent(address.substr(address.indexOf("/") + 1));
	address = address.substr(0, address.indexOf("/"));
} else if(address.indexOf("@") > -1) {
	additional = decodeURIComponent(address.substr(address.indexOf("@")));
	address = address.substr(0, address.indexOf("@"));
}

repo = new Repository(address, zeroPage);