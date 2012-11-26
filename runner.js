var http = require('http');
var Runner = function() {};

Runner.prototype.start = function(platform) {
  http.createServer(function(req, res) { 
    req.queryParams = { };
    var env = { request: req, response: res, target: {}, proxy: { pathSuffix: req.url } };
    platform.call(env);
  }).listen(process.env.PORT || 3000);
};

module.exports = new Runner();
