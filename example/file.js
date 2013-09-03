var fs = require('fs');
var argo = require('../');

argo()
  .get('^/hello.txt$', function(handle) {
    handle('request', function(env, next) {
      var filename = __dirname + '/hello.txt';
      console.log(filename);
      fs.stat(filename, function(err, stats) {
        env.response.setHeader('Content-Length', stats.size);
        env.response.setHeader('Content-Type', 'text/plain');
        env.response.body = fs.createReadStream(filename)
        next(env);
      });
    });
  })
  .listen(process.env.PORT || 3000);
