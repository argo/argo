var cluster = require('cluster');
var http = require('http');
var Runner = function() {};

var numCPUs = require('os').cpus().length;

Runner.prototype.listen = function(platform, port) {
  /*if (cluster.isMaster) {
    for (var i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', function(worker, code, signal) {
      console.log('LOG: worker ' + worker.process.pid + ' died');
    });
  } else*/ {
    var app = platform.build();
    http.createServer(function(req, res) {
      req.queryParams = { };
      var env = { request: req, response: res, target: {}, proxy: { pathSuffix: req.url } };
      app(env);
    }).listen(port);
  }
};

module.exports = new Runner();
