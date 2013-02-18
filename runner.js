var cluster = require('cluster');
var domain = require('domain');
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
    var serverDomain = domain.create();
    serverDomain.run(function domainRunner() {
      http.createServer(function httpRequestHandler(req, res) {
        var requestDomain = domain.create();
        requestDomain.add(req);
        requestDomain.add(res);
        // TODO: Remove asterisk.  Fix reporting in dev mode.
        requestDomain.on('error', function(err) {
          console.log('ERROR:', err.toString(), err.stack, req.url, err);

          try {
            res.writeHead(500);
            res.end('Internal Server Error');
            res.on('close', function() {
              requestDomain.dispose();
            });
          } catch (err) {
            console.log('ERROR: Unable to send 500 Internal Server Error', 
              err.toString(), err.stack, req.url, err);
            requestDomain.dispose();
          }
        });
        req.queryParams = {};
        res.headers = {};
        var env = new Environment();
        env.request = req;
        env.response = res;
        env.target = {};
        env.argo = {};
        //var env = { request: req, response: res, target: {}, proxy: { pathSuffix: req.url } };
        app(env);
      }).listen(port);
    });
  }
};

function Environment() {
  this.request = null;
  this.response = null;
  this.target = null;
  this.proxy = null;
  this.argo = null;
}

module.exports = new Runner();
