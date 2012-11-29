var http = require('http');
var Runner = function() {};

Runner.prototype.listen = function(platform, port) {
  var app = platform.build();
  http.createServer(function(req, res) { 
    req.queryParams = { };
    var env = { request: req, response: res, target: {}, proxy: { pathSuffix: req.url } };
    app(env);
  }).listen(port);
};

module.exports = new Runner();
