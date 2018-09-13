module.exports = {
  target: 'node',
  mode: 'development',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.ts'],
    modules: ["node_modules"],
  }
};
