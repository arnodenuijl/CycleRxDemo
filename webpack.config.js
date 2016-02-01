var ExtractTextPlugin = require("extract-text-webpack-plugin");
var path = require('path');

module.exports = {
    devtool: 'sourcemap',
    entry: {
        javascript: "./src/app.ts",
        html: "./src/index.html",
    },
    output: {
        path: path.resolve('./dist/'),
        filename: "bundle.js"
    },
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js']
    },
    module: {
        loaders: [
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("style-loader", "css-loader"),
                include: path.resolve('src'),

            },
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                query: {
                    'doTypeCheck': false
                },
                include: path.resolve('src'),
                exclude: /node_modules/
            },
            {
                test: /\.html$/,
                loader: "file?name=[name].[ext]",
            },
        ]
    },
    plugins: [
        new ExtractTextPlugin("./dist/styles.css", {allChunks: true})
    ]
};
