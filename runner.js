var cluster = require('cluster');
var domain = require('domain');
var http = require('http');
var util = require('util');

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
        var env = new Environment(req, res);
        //var env = { request: req, response: res, target: {}, proxy: { pathSuffix: req.url } };
        app(env);
      }).listen(port);
    });
  }
};

function Environment(request, response) {
  var that = this;

  this.request = request;
  //this.request = new Request(request);
  /*this.request = {};
  this.request.__proto__ = http.IncomingMessage.prototype;
  this.request._request = request;
  this.request.body = null;
  this.request.getBody = function() {};

  Object.keys(request).forEach(function(key) {
    that.request[key] = request[key];
  });*/

  this.response = response;
  //this.response = new Response(response);
  /*this.response.__proto__ = http.ServerResponse.prototype;
  this.response = {};
  this.response.__proto__ = http.ServerResponse.prototype;
  this.response._response = response;
  this.response.body = null;
  this.response.headers = {};
  this.response.getBody = function() {};*/

  /*Object.keys(response).forEach(function(key) {
    that.response[key] = response[key];
  });*/
  
  this.target = {};
  this.argo = {};
}

function Request(request) {
  this._request = request;
  this.body = null;
  this.getBody = function() {};

  this.method = this._request.method;
  this.url = this._request.url;
  this.httpVersion = this._request.httpVersion;
  this.headers = this._request.headers;
  this.trailers = this._request.trailers;
}

function Response(response) {
  this._response = response;
  this.body = null;
  this.headers = {};
  this.getBody = function() {};

  var that = this;

  Object.keys(this._response).forEach(function(key) {
    that[key] = that._response[key];
  });

  /*this.body = null;
  this.getBody = function() {};

  this.statusCode = this._response.statusCode;
  this.headers = this._response.headers;
  
  this.writeHead = this._response.writeHead;
  this.write = this._response.write;
  this.end = this._response.end;

  this.getHeader = this._response.getHeader;
  this.setHeader = this._response.setHeader;
  this.removeHeader = this._response.removeHeader;

  this.addTrailers = this._response.addTrailers;*/
}

Response.prototype.setHeader = function() {
  return this._response.setHeader.apply(this._response, Array.prototype.slice.call(arguments));
};

Response.prototype.writeHead = function() {
  console.log(arguments);
  return this._response.writeHead.apply(this._response, Array.prototype.slice.call(arguments));
};

Response.prototype.end = function() {
  console.log(arguments);
  return this._response.end.apply(this._response, Array.prototype.slice.call(arguments));
};

module.exports = new Runner();
