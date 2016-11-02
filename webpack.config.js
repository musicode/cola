var webpack = require('webpack');
var env = process.env.WEBPACK_ENV;

var libraryName = 'Cola';

var plugins = [ ];
var outputFilename = '.js';

var envVariables = { };

if (env === 'release') {
    outputFilename = '.min' + outputFilename;
    plugins.push(
        new webpack.optimize.UglifyJsPlugin({
            minimize: true
        })
    );
}
else if (env === 'dev') {
    envVariables.__DEV__ = true;
    plugins.push(
        new webpack.HotModuleReplacementPlugin()
    );
}

plugins.push(
    new webpack.DefinePlugin(envVariables)
);

module.exports = {
    devtool: 'eval-source-map',

    entry: __dirname + '/src/' + libraryName + '.js',
    output: {
        path: __dirname + '/dist',
        filename: '[name]' + outputFilename,
        library: libraryName,
        libraryTarget: 'umd',
        umdNamedDefine: true
    },

    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                query: {
                    presets: ['es2015', 'stage-0']
                }
            }
        ]
    },

    plugins: plugins,

    devServer: {
        port: 9191,
        hot: true,
        inline: true,
    }
}