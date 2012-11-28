var http = require('http');
var Builder = require('./builder');
var runner = require('./runner');

var Platform = function() {
  this._router = {};
  this.builder = null;
};

Platform.prototype.run = runner.start;

Platform.prototype.init = function(config) {
 var that = this;

 this.builder = new Builder();
 config.apply(this, [this.builder]);

 this.builder.use(function(handlers) { 
   console.log('adding router handlers');

   that._route(that._router, handlers);
 });

 this.builder.run(that._target);

 return this;
};

Platform.prototype.call = function(env) {
  return this.builder.call(env);
}

Platform.prototype.route = function(path, handlers) {
  this._router[path] = handlers;
};

Platform.prototype._route = function(router, handlers) {
  /* Hacky.  Cache this stuff. */

  handlers.add('request', function(env, next) {
    console.log('request routing...');
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        var handlers = function() {
          this.request = null;
          this.response = null;
        }
        
        handlers.add = function(name, cb) {
          if (name === 'request') {
            this.request = cb;
          } else if (name === 'response') {
            this.response = cb;
          }
        }

        router[key](handlers);
        
        handlers.request(env, next);
      }
    }
  });

  handlers.add('response', { hoist: true }, function(env, next) {
    console.log('response routing...');
    for (var key in router) {
      if (env.proxy.pathSuffix.search(key) != -1) {
        var handlers = function() {
          this.request = null;
          this.response = null;
        }
        
        handlers.add = function(name, cb) {
          if (name === 'request') {
            this.request = cb;
          } else if (name === 'response') {
            this.response = cb;
          }
        }

        router[key](handlers);
        
        handlers.response(env, next);
      }
    }
  });
};

Platform.prototype._target = function(env, next) {
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

module.exports = new Platform();
