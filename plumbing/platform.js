var http = require('http');
var Builder = require('./builder');

var Platform = function() {
  this._router = {};
  this.builder = null;
};

Platform.prototype.init = function(config) {
 var that = this;

 this.builder = new Builder();
 config.apply(this, [this.builder]);

 this.builder.use(function(handler) { 
   console.log('adding router handlers');

   that._route(that._router, handler);
 });

 this.builder.run(that._target);

 return this;
};

Platform.prototype.call = function(env) {
  return this.builder.call(env);
}

Platform.prototype.route = function(path, handler) {
  this._router[path] = handler;
};

Platform.prototype._route = function(router, handler) {
  /* Hacky.  Cache this stuff. */

  handler.on('request', function(env, next) {
    console.log('in route - request');
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        var handler = function() {
          this.request = null;
          this.response = null;
        }
        
        handler.on = function(name, cb) {
          if (name === 'request') {
            this.request = cb;
          } else if (name === 'response') {
            this.response = cb;
          }
        }

        router[key](handler);
        
        handler.request(env, next);
      }
    }
  });

  handler.on('response', function(env, next) {
    console.log('in route - response');
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        var handler = function() {
          this.request = null;
          this.response = null;
        }
        
        handler.on = function(name, cb) {
          if (name === 'request') {
            this.request = cb;
          } else if (name === 'response') {
            this.response = cb;
          }
        }

        router[key](handler);
        
        handler.response(env, next);
      }
    }
  });
};

Platform.prototype._target = function(env, next) {
  console.log('target:', env.target);
  if (env.target && env.target.url) {
    // TODO: Support non-GET options.
    
    http.get(env.target.url, function(res) {
      console.log(res._headerNames);
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

module.exports = new Platform();
