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
   console.log('adding router handlers');
   that._route(that._router, handlers);
  });

  // spooler
  this.builder.use(function(handle) {
    console.log('adding spooler handlers');
    handle('request', { hoist: true }, function(env, next) {
      console.log('executing request spooler');
      var body = '';
      env.request.on('data', function(chunk) {
        body += chunk;
      });

      env.request.on('end', function() {
        env.request.body = body;
        next(env);
      });
    });

    handle('response', { hoist: true }, function(env, next) {
      console.log('executing response spooler');
      var body = '';
      env.target.response.on('data', function(chunk) {
        body += chunk;
      });

      env.target.response.on('end', function() {
        env.response.body = body;
        next(env);
      });
    });
  });

  // response ender
  this.builder.use(function(handle) {
    console.log('adding response ender');
    handle('response', function(env, next) {
      console.log('executing response ender');
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
    console.log('request routing...');
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        var handlers = {
          request: null,
          response: null
        }
        
        handlers.add = function(name, cb) {
          if (name === 'request') {
            handlers.request = cb;
          } else if (name === 'response') {
            handlers.response = cb;
          }
        }

        router[key](handlers.add);
        
        handlers.request(env, next);
      }
    }
  });

  handle('response', { hoist: true }, function(env, next) {
    console.log('response routing...');
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        var handlers = {
          request: null,
          response: null
        }
        
        handlers.add = function(name, cb) {
          if (name === 'request') {
            handlers.request = cb;
          } else if (name === 'response') {
            handlers.response = cb;
          }
        }

        router[key](handlers.add);
        
        handlers.response(env, next);
      }
    }
  });
};

Argo.prototype._target = function(env, next) {
  console.log('executing target');
  if (env.target && env.target.url) {
    // TODO: Support non-GET options.
    
    http.get(env.target.url, function(res) {
      for (var key in res.headers) {
        env.response.setHeader(capitalize(key), res.headers[key]);
      }
      env.target.response = res;
      //env.target.response.pipe(env.response);
      if (next) {
        next(env);
      }
    });
  } else {
    env.response.writeHead(404, { 'Content-Type': 'text/plain' });
    env.response.end('Not Found');
  }
};

function capitalize(str) {
  return str.split('-').map(function(string) {
    if (string === 'p3p') return 'P3P';
    return string.charAt(0).toUpperCase() + string.slice(1);
  }).join('-');
}

module.exports = function() { return new Argo() };
