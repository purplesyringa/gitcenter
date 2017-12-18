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
	query = "\
		(tags LIKE '%," + sqlEscape(filter.value) + ",%' ESCAPE '^') OR\
		(tags LIKE '" + sqlEscape(filter.value) + ",%' ESCAPE '^') OR\
		(tags LIKE '%," + sqlEscape(filter.value) + "' ESCAPE '^') OR\
		(tags LIKE '" + sqlEscape(filter.value) + "' ESCAPE '^')\
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
		showHeader(1, content.git);
		showTabs(1);

		return repo.issues.filterObjects(currentPage, query);
	})
	.then(objects => {
		showObjects("object", objects);
		showNavigation("object", objects, currentPage, additional[0]);
	});