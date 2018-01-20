const path = require("path");

const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
	entry: "./src/main.js",
	output: {
		path: path.resolve(__dirname, "./dist"),
		publicPath: "./",
		filename: "build.js"
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				loader: "vue-loader"
			},
			{
				test: /\.css$/,
				loader: "style!css"
			},
			{
				test: /\.s[ac]ss$/,
				use: [
					{
						loader: "style-loader"
					},
					{
						loader: "css-loader"
					},
					{
						loader: "sass-loader"
					}
				]
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
			template: "./src/index.html",
			seo: {
				keywords: "gitcenter,git,repository",
				description: "GitHub for ZeroNet"
			}
		}),
		new CopyWebpackPlugin([
			{
				from: "./src/dbschema.json",
				to: "./dbschema.json"
			}
		])
	]
};