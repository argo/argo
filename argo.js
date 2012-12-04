var http = require('http');
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

  this.builder.use(function(handlers) { 
   that._route(that._router, handlers);
  });

  // spooler
  this.builder.use(function(handle) {
    handle('request', { hoist: true }, function(env, next) {
      var start = +Date.now();

      var body = '';
      env.request.on('data', function(chunk) {
        body += chunk;
      });

      env.request.on('end', function() {
        env.request.body = body;
        console.log(new Date() + ': Duration (request spooler): ' + (+Date.now() - start) + 'ms');
        next(env);
      });
    });

    handle('response', { hoist: true }, function(env, next) {
      var start = +Date.now();

      var body = '';
      env.target.response.on('data', function(chunk) {
        body += chunk;
      });

      env.target.response.on('end', function() {
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
  if (env.target && env.target.url) {
    // TODO: Support non-GET options.
      
    env.trace('target', function() {
      http.get(env.target.url, function(res) {
        for (var key in res.headers) {
          //env.response.setHeader(capitalize(key), res.headers[key]);
          env.response.setHeader(key, res.headers[key]);
        }
        env.target.response = res;
        //env.target.response.pipe(env.response);
        if (next) {
          next(env);
        }
      });
    });
  } else {
    env.trace('target', function() {
      env.response.writeHead(404, { 'Content-Type': 'text/plain' });
      env.response.end('Not Found');
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
