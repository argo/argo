var http = require('http');
var url = require('url');
var Builder = require('./builder');
var runner = require('./runner');
var tracer = require('./tracer');

var Argo = function() {
  this._router = {};
  this.builder = new Builder();
};

Argo.prototype.include = function(mod) {
  var p = mod.package(this);
  p.install();
  return this;
};

Argo.prototype.listen = function(port) {
  runner.listen(this, port);
  return this;
};

Argo.prototype.use = function(middleware) {
  if (middleware.package) {
    return this.include(middleware);
  }
  this.builder.use(middleware);
  return this;
};

Argo.prototype.build = function() {
  var that = this;

  /*that.builder.use(function(addHandler) {
    addHandler('request', { hoist: true }, function(env, next) {
      env.startTime = +Date.now();
      next(env);
    });
  });

  that.builder.use(function(addHandler) {
    addHandler('response', function(env, next) {
      var stop = +Date.now();
      var duration = stop - env.startTime;
      env.printTrace('total', 'Duration (total): ' + duration + 'ms', { duration: duration });
      next(env);
    });
  });*/

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
        var duration = (+Date.now() - start);
        env.printTrace('request spooler', 'Duration (request spooler): ' + duration + 'ms', { duration: duration });
        next(env);
      });
    });

    handle('response', { hoist: true }, function(env, next) {
      if (!env.target.response) {
        next(env);
        return;
      }
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
        var duration = (+Date.now() - start);
        env.printTrace('target response', 'Duration (response spooler): ' + duration + 'ms', { duration: duration });
        next(env);
      });
    });
  });

  that.builder.use(tracer);

  this.builder.run(that._target);

  // response ender
  this.builder.use(function(handle) {
    handle('response', function(env, next) {
      var body = env.response.body;
      env.response.setHeader('Content-Length', body.length); 
      env.response.writeHead(env.response.statusCode, env.response.headers);
      env.response.end(body);
    });
  });

  /*
  this.builder.use(function(handle) {
    handle('request', function(env, next) {
      if (!env._routed || (!env.target || !env.target.url)) {
        env.response.writeHead(404);
        env.response.end();
      }
    });
  });*/

  return this.builder.build();
};

Argo.prototype.call = function(env) {
  return this.builder.call(env);
}

Argo.prototype.route = function(path, handlers) {
  this._router[path] = handlers;
  return this;
};

Argo.prototype.get = function(path, handlers) {

};

Argo.prototype._route = function(router, handle) {
  /* Hacky.  Cache this stuff. */

  handle('request', function(env, next) {
    var start = +Date.now();
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        env._routed = true;
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

        var duration = (+Date.now() - start);
        env.printTrace('request routing', 'Duration (route request): ' + duration + 'ms', { duration: duration });
        
        handlers.request(env, next);
      }
    }
    
    if (!env._routed) {
      next(env);
    }
  });

  handle('response', { hoist: true }, function(env, next) {
    if (!env._routed) {
      env.response.statusCode = 404;
      next(env);
      return;
    }
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

        var duration = (+Date.now() - start);
        env.printTrace('response routing', 'Duration (route response): ' + duration + 'ms', { duration: duration });

        router[key](handlers.add);
        
        if (handlers.response) {
          handlers.response(env, next);
        } else {
          next(env);
        }
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
        var duration = (+Date.now() - start);
        env.printTrace('target connection', 'Duration (target): ' + duration + 'ms', { duration: duration });
        next(env);
      }
    });

    req.end();
  } else {
    next(env);
    /*env.response.writeHead(404, { 'Content-Type': 'text/plain' });
    env.response.end('Not Found');
    env.printTrace('target', 'Duration (target not found): ' + (+Date.now() - start) + 'ms');
    */
  }
};

function capitalize(str) {
  return str.split('-').map(function(string) {
    if (string === 'p3p') return 'P3P';
    return string.charAt(0).toUpperCase() + string.slice(1);
  }).join('-');
}

module.exports = function() { return new Argo() };
