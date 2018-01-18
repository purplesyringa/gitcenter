const vueify = require("vueify");

const gulp = require("gulp");
const browserify = require("browserify");
const source = require("vinyl-source-stream");
const sourcemaps = require("gulp-sourcemaps");
const buffer = require("vinyl-buffer");

const sass = require("gulp-sass");
const minify = require("gulp-minify-css");

const paths = {
	pages: ["src/**/*.html"],
	styles: ["src/sass/**/*.sass"],
	scripts: ["src/**/*.js"]
};

gulp.task("html", function() {
	return gulp.src(paths.pages)
		.pipe(gulp.dest("."));
});

gulp.task("styles", function() {
	return gulp.src(paths.styles)
		.pipe(sass({
			"includePaths": [
				"./node_modules"
			]
		})
		.on("error", sass.logError))
		.pipe(minify())
		.pipe(gulp.dest("./css/"));
});

gulp.task("scripts", function() {
	return browserify({
		basedir: ".",
		debug: true,
		entries: ["src/main.js"],
		cache: {},
		packageCache: {},
		insertGlobals: true
	})
	.transform(vueify)
	.bundle()
	.pipe(source("bundle.js"))
	.pipe(buffer())
	.pipe(sourcemaps.init({ loadMaps: true }))
	.pipe(sourcemaps.write("./"))
	.pipe(gulp.dest("./js/"));
});

gulp.task("watch", function() {
	gulp.watch(paths.scripts, ["scripts"]);
	gulp.watch(paths.styles, ["styles"]);
	gulp.watch(paths.pages, ["html"]);
});

gulp.task("default", ["scripts", "styles", "html"]);