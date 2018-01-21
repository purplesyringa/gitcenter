const path = require("path");

const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
	context: path.resolve(__dirname, "./src"),
	entry: "./main.js",
	output: {
		path: path.resolve(__dirname, "./dist"),
		publicPath: "./",
		filename: "build.js"
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				loader: "vue-loader",
				options: {
					loaders: {
						scss: "vue-style-loader!css-loader!sass-loader",
						sass: "vue-style-loader!css-loader!sass-loader?indentedSyntax",
					}
				}
			},
			{
				test: /\.css$/,
				loader: "style-loader!css-loader"
			},
			{
				test: /\.s[ac]ss$/,
				loader: "style-loader!css-loader!sass-loader?indentedSyntax"
			},
			{
				test: /\.js$/,
				use: [
					{
						loader: "babel-loader",
						options: {
							presets: ["env"]
						}
					}
				],
				exclude: /node_modules/
			},
			{
				test: /\.(gif|jpe?g|svg|png)$/,
				loader: "file-loader"
			}
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			title: "Git Center",
			template: "./index.html",
			seo: {
				keywords: "gitcenter,git,repository",
				description: "GitHub for ZeroNet"
			}
		}),
		new CopyWebpackPlugin([
			{
				from: "./dbschema.json",
				to: "./dbschema.json"
			}
		])
	]
};