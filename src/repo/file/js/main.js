let zeroFrame = new ZeroFrame();
let zeroPage = new ZeroPage(zeroFrame);

let address = location.search.replace(/[?&]wrapper_nonce=.*/, "").replace("?", "");
if(!address) {
	location.href = "..";
}

let path = "";
if(address.indexOf("/") > -1) {
	path = address.substr(address.indexOf("/") + 1);
	address = address.substr(0, address.indexOf("/"));
}

let repo = new Repository(address, zeroPage);

function showTitle(title) {
	let name = document.getElementById("repo_name");
	name.textContent = title;
	name.innerHTML += document.getElementById("edit_icon_tmpl").innerHTML;

	document.getElementById("edit_icon").onclick = renameRepo;
}

function renameRepo() {
	let newName;
	return zeroPage.prompt("New name:")
		.then(n => {
			newName = n;

			return repo.rename(newName);
		})
		.then(() => showTitle(newName));
}

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		showTitle(content.title);

		return repo.getFile("master", path);
	})
	.then(blob => {
		let fileContent = document.getElementById("file_content");
		fileContent.textContent = repo.git.arrayToString(blob);
		//hljs.highlightBlock(fileContent);

		// Show path
		document.getElementById("files_root").href = "../?" + address;

		let filesPath = document.getElementById("files_path");
		let parts = path.split("/").filter(part => part.length);
		parts.forEach((part, i) => {
			let node = document.createElement("span");
			node.textContent = i == parts.length - 1 ? "" : " › ";

			let link = document.createElement(i == parts.length - 1 ? "span" : "a");
			link.textContent = part;
			if(i < parts.length - 1) {
				link.href = "../?" + address + "/" + parts.slice(0, i + 1).join("/");
			}
			node.insertBefore(link, node.firstChild);

			filesPath.appendChild(node);
		});
	});