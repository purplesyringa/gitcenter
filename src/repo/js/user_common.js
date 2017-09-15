let zeroFrame = new ZeroFrame();
let zeroPage = new ZeroPage(zeroFrame);

let address = location.search.replace(/[?&]wrapper_nonce=.*/, "").replace("?", "");
if(!address) {
	location.href = "..";
}

let additional = "";
if(address.indexOf("/") > -1) {
	additional = address.substr(address.indexOf("/") + 1);
	address = address.substr(0, address.indexOf("/"));
} else if(address.indexOf("@") > -1) {
	additional = address.substr(address.indexOf("@"));
	address = address.substr(0, address.indexOf("@"));
}

let repo = new Repository(address, zeroPage);