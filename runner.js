var cluster = require('cluster');
var domain = require('domain');
var http = require('http');
var util = require('util');

var Runner = function() {};

Runner.prototype.listen = function(platform, port) {
  var app = platform.build();
  var serverDomain = domain.create();

  serverDomain.run(function domainRunner() {
    http.createServer(function httpRequestHandler(req, res) {
      var requestDomain = domain.create();

      requestDomain.add(req);
      requestDomain.add(res);

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

      app.run(req, res);
    })
    .listen(port);
  });
};

module.exports = new Runner();
