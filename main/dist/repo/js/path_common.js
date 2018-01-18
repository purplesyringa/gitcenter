zeroFrame = new ZeroFrame();
zeroPage = new ZeroPage(zeroFrame);
zeroAuth = new ZeroAuth(zeroPage);

let address = location.search.replace(/[?&]wrapper_nonce=.*/, "").replace("?", "");
if(!address) {
	location.href = "..";
}

let path = "";
if(address.indexOf("/") > -1) {
	path = decodeURIComponent(address.substr(address.indexOf("/") + 1));
	address = address.substr(0, address.indexOf("/"));
} else if(address.indexOf("@") > -1) {
	path = decodeURIComponent(address.substr(address.indexOf("@")));
	address = address.substr(0, address.indexOf("@"));
}

let branch = "";
if(path.indexOf("@") > -1) {
	let tempPath = path.replace(/@@/g, "\0"); // @ is escaped
	path = tempPath.substr(0, tempPath.indexOf("@")).replace(/\0/g, "@");
	branch = tempPath.substr(tempPath.indexOf("@") + 1).replace(/\0/g, "@");
} else {
	path = path.replace(/@@/g, "@");
}

repo = new Repository(address, zeroPage);