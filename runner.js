var http = require('http');
var Runner = function() {};

Runner.prototype.listen = function(platform, port) {
  http.createServer(function(req, res) { 
    req.queryParams = { };
    var env = { request: req, response: res, target: {}, proxy: { pathSuffix: req.url } };
    platform.call(env);
  }).listen((process.env.PORT || port) || 3000);
};

module.exports = new Runner();
