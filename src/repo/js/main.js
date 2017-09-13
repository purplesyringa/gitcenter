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

		return repo.getFiles("master", path);
	})
	.then(files => {
		let table = document.getElementById("files");
		files
			.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
			.forEach(file => {
				let tr = document.createElement("tr");
				tr.onclick = () => {
					if(file.type == "unknown") {
						return;
					}

					location.href = (
						(file.type == "file" ? "file/" : "") +
						"?" + address +
						"/" + (path ? path + "/" : "") + file.name
					);
				};

				let name = document.createElement("td");
				name.textContent = file.name;
				tr.appendChild(name);

				let icon = document.createElement("img");
				icon.className = "file-icon";
				icon.src = "../img/" + file.type + ".svg";
				name.insertBefore(icon, name.firstChild);

				table.appendChild(tr);
			});

		let filesBack = document.getElementById("files_back");
		if(path == "" || path == "/") {
			filesBack.style.display = "none";
		} else {
			filesBack.onclick = () => {
				let parts = path.split("/").filter(part => part.length);
				parts.pop();
				location.href = "?" + address + "/" + parts.join("/");
			};
		}

		document.getElementById("files_root").href = "?" + address;

		let filesPath = document.getElementById("files_path");
		let parts = path.split("/").filter(part => part.length);
		parts.forEach((part, i) => {
			let node = document.createElement("span");
			node.textContent = " › ";

			let link = document.createElement("a");
			link.textContent = part;
			link.href = "?" + address + "/" + parts.slice(0, i + 1).join("/");
			node.insertBefore(link, node.firstChild);

			filesPath.appendChild(node);
		});
	});