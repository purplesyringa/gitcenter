let zeroFrame = new ZeroFrame();
let zeroPage = new ZeroPage(zeroFrame);

let repo = location.search.replace(/[?&]wrapper_nonce=.*/, "").replace("?", "");
if(!repo) {
	location.href = "..";
}
console.log(repo);