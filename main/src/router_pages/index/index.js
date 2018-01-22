import {zeroPage, zeroDB} from "../../route.js";
import Repository from "../../repo/repo.js";

async function getDownloaded() {
	if(getDownloaded.cache) {
		return getDownloaded.cache;
	}

	return getDownloaded.cache = await Repository.getDownloadedRepos(zeroPage);
}

function parse(query) {
	let required = [];
	let maybe = [];
	let state = "";
	let sort = "stars";
	let isDownloaded = false;
	query.split(/\s+/)
		.filter(word => word.length)
		.forEach(word => {
			word = word
				.replace(/\*/g, "%")
				.replace(/\?/g, "_");

			if(word.indexOf("sort:") > -1) {
				sort = word.substr(5);
			} else if(word[0] == "+" && word.length > 1) {
				required.push("\
					repo_index.description LIKE " + escapeString("%" + word.substr(1) + "%") + "\
					OR\
					repo_index.title LIKE " + escapeString("%" + word.substr(1) + "%") + "\
				");
			} else if(word == "is:downloaded") {
				isDownloaded = true;
			} else {
				maybe.push("\
					repo_index.description LIKE " + escapeString("%" + word + "%") + "\
					OR\
					repo_index.title LIKE " + escapeString("%" + word + "%") + "\
				");
			}
		});

	return {sort, required, isDownloaded, maybe};
};

async function load({sort, required, isDownloaded, maybe}) {
	if(sort == "stars") {
		sort = "stars DESC";
	} else if(sort == "date") {
		sort = "\
			CASE WHEN date_added IS NULL\
				THEN 0\
				ELSE date_added\
			END DESC\
		";
	} else if(sort == "random") {
		sort = "RANDOM() ASC";
	} else {
		sort = "stars DESC";
	}

	const downloaded = await getDownloaded();

	return await zeroDB.query(("\
		SELECT repo_index.*, json.cert_user_id, COUNT(repo_stars.address) AS stars\
		FROM repo_index, json\
		LEFT JOIN repo_stars ON repo_stars.address = repo_index.address AND repo_stars.star = 1\
		\
		WHERE repo_index.json_id = json.json_id AND (" +
			(required.length ? "(" + required.join(") AND (") + ")" : "1 = 1") + "\
			AND " +
			(maybe.length ? "(" + maybe.join(") OR (") + ")" : "1 = 1") + "\
			AND " +
			(isDownloaded ? "?" : "1 = 1") + "\
		)\
		GROUP BY repo_index.address\
		ORDER BY " + sort + "\
	").trim(), {
		"repo_index.address": downloaded
	});
};

export async function search(query) {
	const downloaded = await getDownloaded();

	const index = await load(parse(query));
	return index.map(repo => {
		repo.downloaded = downloaded.indexOf(repo.address) > -1;
		return repo;
	});
};