var http = require('http');
var url = require('url');
var Builder = require('./builder');
var runner = require('./runner');

var Argo = function() {
  this._router = {};
  this.builder = new Builder();
};

Argo.prototype.listen = function(port) {
  runner.listen(this, port);
  return this;
};

Argo.prototype.use = function(middleware) {
  this.builder.use(middleware);
  return this;
};

Argo.prototype.build = function() {
  var that = this;

  var hasRoutes = false;
  for (var prop in that._router) {
    if (!hasRoutes && that._router.hasOwnProperty(prop)) {
      hasRoutes = true;
    }
  }

  if (hasRoutes) {
    this.builder.use(function(handlers) { 
     that._route(that._router, handlers);
    });
  }

  // spooler
  this.builder.use(function(handle) {
    handle('request', { hoist: true }, function(env, next) {
      var start = +Date.now();

      var buf = [];
      var len = 0;
      env.request.on('data', function(chunk) {
        buf.push(chunk);
        len += chunk.length;
      });

      env.request.on('end', function() {
        var body;
        if (buf.length && Buffer.isBuffer(buf[0])) {
          body = new Buffer(len);
          var i = 0;
          buf.forEach(function(chunk) {
            chunk.copy(body, i, 0, chunk.length);
            i += chunk.length;
          });
        } else if (buf.length) {
          body = buf.join('');
        }

        env.request.body = body;
        console.log(new Date() + ': Duration (request spooler): ' + (+Date.now() - start) + 'ms');
        next(env);
      });
    });

    handle('response', { hoist: true }, function(env, next) {
      var start = +Date.now();

      var buf = []; 
      var len = 0;
      env.target.response.on('data', function(chunk) {
        buf.push(chunk);
        len += chunk.length;
      });

      env.target.response.on('end', function() {
        var body;
        if (buf.length && Buffer.isBuffer(buf[0])) {
          body = new Buffer(len);
          var i = 0;
          buf.forEach(function(chunk) {
            chunk.copy(body, i, 0, chunk.length);
            i += chunk.length;
          });
          body = body.toString('binary');
        } else if (buf.length) {
          body = buf.join('');
        }

        env.response.body = body;
        console.log(new Date() + ': Duration (response spooler): ' + (+Date.now() - start) + 'ms');
        next(env);
      });
    });
  });

  // response ender
  this.builder.use(function(handle) {
    handle('response', function(env, next) {
      var body = env.response.body;
      env.response.setHeader('Content-Length', body.length); 
      env.response.end(body);
    });
  });

  this.builder.run(that._target);

  return this.builder.build();
};

Argo.prototype.call = function(env) {
  return this.builder.call(env);
}

Argo.prototype.route = function(path, handlers) {
  this._router[path] = handlers;
  return this;
};

Argo.prototype._route = function(router, handle) {
  /* Hacky.  Cache this stuff. */

  handle('request', function(env, next) {
    var start = +Date.now();
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        var handlers = {
          request: null,
          response: null
        }
        
        handlers.add = function(name, opts, cb) {
          if (typeof opts === 'function') {
            cb = opts;
            opts = null;
          }

          if (name === 'request') {
            handlers.request = cb;
          } else if (name === 'response') {
            handlers.response = cb;
          }
        }

        router[key](handlers.add);

        console.log(new Date() + ': Duration (route request): ' + (+Date.now() - start) + 'ms');
        
        handlers.request(env, next);
      }
    }
  });

  handle('response', { hoist: true }, function(env, next) {
    var start = +Date.now();
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        var handlers = {
          request: null,
          response: null
        }
        
        handlers.add = function(name, opts, cb) {
          if (typeof opts === 'function') {
            cb = opts;
            opts = null;
          }

          if (name === 'request') {
            handlers.request = cb;
          } else if (name === 'response') {
            handlers.response = cb;
          }
        }

        console.log(new Date() + ': Duration (route response): ' + (+Date.now() - start) + 'ms');
        router[key](handlers.add);
        
        handlers.response(env, next);
      }
    }
  });
};

Argo.prototype._target = function(env, next) {
  var start = +Date.now();

  if (env.target && env.target.url) {
    var options = {};
    options.method = env.request.method || 'GET';

    // TODO: Make Agent configurable.
    options.agent = new http.Agent();
    options.agent.maxSockets = 1024;

    options.headers = env.request.headers;
    options.headers['Connection'] = 'keep-alive';
    options.headers['Host'] = options.hostname;

    var parsed = url.parse(env.target.url);
    options.hostname = parsed.hostname;
    options.port = parsed.port || 80;
    options.path = parsed.path;

    if (parsed.auth) {
      options.auth = parsed.auth;
    }

    var req = http.request(options, function(res) {
      for (var key in res.headers) {
        //env.response.setHeader(capitalize(key), res.headers[key]);
        env.response.setHeader(key, res.headers[key]);
      }

      env.target.response = res;

      if (next) {
        console.log(new Date() + ': Duration (target): ' + (+Date.now() - start) + 'ms');
        next(env);
      }
    });

    req.end();
  } else {
    env.trace('target', function() {
      env.response.writeHead(404, { 'Content-Type': 'text/plain' });
      env.response.end('Not Found');
      console.log(new Date() + ': Duration (target not found): ' + (+Date.now() - start) + 'ms');
    });
  }
};

function capitalize(str) {
  return str.split('-').map(function(string) {
    if (string === 'p3p') return 'P3P';
    return string.charAt(0).toUpperCase() + string.slice(1);
  }).join('-');
}

module.exports = function() { return new Argo() };
