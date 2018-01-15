if(address == "1RepoXU8bQE9m7ssNwL4nnxBnZVejHCc6") {
	location.href = "../../default/";
}

additional = additional.split("/");

let currentPage = Number.isSafeInteger(+additional[1]) ? +additional[1] : 0;
let filter = additional[0];
filter = {
	type: filter.substr(0, filter.indexOf(":")),
	value: filter.substr(filter.indexOf(":") + 1)
};

let query;

function sqlEscape(str) {
	return str
		.replace(/\^/g, "^")
		.replace(/[%_]/g, "^$0")
		.replace(/'/g, "$0$0");
}

if(filter.type == "tag") {
	let tag = filter.value;

	query = "\
		(tags LIKE '%," + sqlEscape(tag) + ",%' ESCAPE '^') OR\
		(tags LIKE '" + sqlEscape(tag) + ",%' ESCAPE '^') OR\
		(tags LIKE '%," + sqlEscape(tag) + "' ESCAPE '^') OR\
		(tags LIKE '" + sqlEscape(tag) + "' ESCAPE '^')\
	";

	let color = repo.tagToColor(tag);
	let map = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#039;"
	};
	let tagHTML = tag.replace(/[&<>"']/g, m => map[m]);

	document.getElementById("filter").innerHTML = "\
		You are searching issues and pull requests for tag\
		<div class='tag' id='tag' style='\
			background-color: " + color.background + " !important;\
			color: " + color.foreground + " !important;\
		'>" + tagHTML + "</div>\
	";
}

repo.addMerger()
	.then(() => {
		return repo.getContent();
	})
	.then(content => {
		if(!content.installed) {
			location.href = "../../install/?" + address;
		}

		setTitle("Filter " + additional[0] + " - " + content.title);

		showTitle(content.title);
		showHeader(1, content);
		showTabs(1);

		return repo.issues.filterObjects(currentPage, query);
	})
	.then(objects => {
		showObjects("object", objects);
		showNavigation("object", objects, currentPage, additional[0]);
	});