var http = require('http');
var url = require('url');
var Builder = require('./builder');
var runner = require('./runner');

var Argo = function(_http) {
  this._router = {};
  this.builder = new Builder();
  this._http = _http || http;

  var incoming = this._http.IncomingMessage.prototype;
  if (!incoming._modifiedHeaderLine) {
    var _addHeaderLine = incoming._addHeaderLine;

    incoming._modifiedHeaderLine = true;
    incoming._addHeaderLine = function(field, value) {
      this._rawHeaderNames = this._rawHeaderNames || {};
      this._rawHeaderNames[field.toLowerCase()] = field;

      _addHeaderLine.call(this, field, value);
    };
  }
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

Argo.prototype.target = function(url) {
  return this.use(function(addHandler) {
    addHandler('request', function(env, next) {
      env.target.url = url + (env.request.url || '');
      next(env);
    });
  });
};

Argo.prototype.build = function(isNested) {
  var that = this;

  var hasRoutes = false;
  for (var prop in that._router) {
    if (!hasRoutes && that._router.hasOwnProperty(prop)) {
      hasRoutes = true;
    }
  }

  this.builder.use(function(addHandler) {
    addHandler('request', function(env, next) {
      env.argo._http = that._http;
      next(env);
    });
  });
  if (hasRoutes) {
    this.builder.use(function addRouteHandlers(handlers) { 
     that._route(that._router, handlers);
    });
  }

  // spooler
  if (!isNested) {
    this.builder.use(function bufferRequest(handle) {
      handle('request', { hoist: true }, function(env, next) {
        env.request.getBody = function(callback) {
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
            //env.printTrace('request spooler', 'Duration (request spooler): ' + duration + 'ms', { duration: duration });

            callback(null, body);
          });
        };
        next(env);
      });

      handle('response', { hoist: true }, function bufferResponse(env, next) {
        if (!env.target.response) {
          next(env);
          return;
        }

        env.response.getBody = function(callback) {
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
            //env.printTrace('target response', 'Duration (response spooler): ' + duration + 'ms', { duration: duration });

            callback(null, body);
          });
        };

        next(env);
      });
    });
  }

  // Removing tracer for now.  Performance is too slow.
  //
  // if (!isNested) {
  //   that.builder.use(tracer);
  // }

  this.builder.run(that._target);

  if (!isNested) {
    // response ender
    this.builder.use(function(handle) {
      handle('response', { sink: true }, function(env, next) {
        if (!env.response.body && env.response.getBody) {
          env.response.getBody(function(err, body) {
            var body = body || '';
            env.response.setHeader('Content-Length', body.length); 
            env.response.writeHead(env.response.statusCode, env.response.headers);
            env.response.end(body);
          });
          return;
        }
        var body = env.response.body || '';
        env.response.setHeader('Content-Length', body.length); 
        env.response.writeHead(env.response.statusCode, env.response.headers);
        env.response.end(body);
      });
    });
  }

  if (isNested) {
    this.builder.use(function(addHandler) {
      addHandler('response', { sink: true }, function(env) {
        if (env.argo.oncomplete) {
          env.argo.oncomplete(env);
        }
      });
    });
  }
  return this.builder.build();
};

Argo.prototype.call = function(env) {
  var app = this.build();
  return app(env);
}

Argo.prototype.route = function(path, options, handlers) {
  if (typeof(options) === 'function') {
    handlers = options;
    options = {};
  }

  options.methods = options.methods || ['*'];
  if (!this._router[path]) {
    this._router[path] = {};
  }

  var that = this;
  options.methods.forEach(function(method) {
    that._router[path][method.toLowerCase()] = handlers;
  });

  return this;
};

var methods = {
  'get': 'GET',
  'post': 'POST',
  'put': 'PUT',
  'del': 'DELETE',
  'head': 'HEAD',
  'options': 'OPTIONS',
  'trace': 'TRACE'
};

Object.keys(methods).forEach(function(method) {
  Argo.prototype[method] = function(path, options, handlers) {
    if (typeof(options) === 'function') {
      handlers = options;
      options = {};
    }
    options.methods = [methods[method]];
    return this.route(path, options, handlers);
  };
});

Argo.prototype.map = function(path, options, handler) {
  if (typeof(options) === 'function') {
    handler = options;
    options = {};
  }

  options.methods = options.methods || ['*'];
  if (!this._router[path]) {
    this._router[path] = {};
  }

  function generateHandler() {
    var argo = new Argo();
    handler(argo);

    var app = argo.build(true);

    return function(addHandler) {
      addHandler('request', function mapHandler(env, next) {
        if (env.request.url[env.request.url.length - 1] === '/') {
          env.request.url = env.request.url.substr(0, env.request.url.length - 1);
        }
        env.request.routeUri = env.request.url.substr(path.length) || '/';
        env.argo.oncomplete = function(env) { next(env); };
        app(env);
      });
    };
  };
  /*var _handler = function(addHandler) {
    addHandler('request', function mapHandler(env, next) {
      if (env.request.url[env.request.url.length - 1] === '/') {
        env.request.url = env.request.url.substr(0, env.request.url.length - 1);
      }
      env.request.routeUri = env.request.url.substr(path.length) || '/';
      var argo = new Argo();
      argo.use(function(addHandler) {
        addHandler('response', next);
      });

      handler(argo);

      var app = argo.build(true);
      app(env);
    });
  };*/

  return this.route(path, options, generateHandler());
};

Argo.prototype._addRouteHandlers = function(handlers) {
  return function add(name, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }

    if (name === 'request') {
      handlers.request = cb;
    } else if (name === 'response') {
      handlers.response = cb;
    }
  };
};

function RouteHandlers() {
  this.request = null;
  this.response = null;
}

Argo.prototype._routeRequestHandler = function(router) {
  var that = this;
  return function routeRequestHandler(env, next) {
    env.argo._routed = false;
    //var start = +Date.now();
    var search = env.request.routeUri || env.request.url;
    for (var key in router) {
      if (search.search(key) !== -1 &&
          (!router[key][env.request.method.toLowerCase()] &&
           !router[key]['*'])) {
        env.response.statusCode = 405;
        next(env);
        return;
      }
      if (search.search(key) != -1 &&
          (router[key][env.request.method.toLowerCase()] ||
           router[key]['*'])) {
        env.argo._routed = true;

        var method = env.request.method.toLowerCase();
        var fn = router[key][method] ? router[key][method] 
          : router[key]['*'];

        var handlers = new RouteHandlers();
        fn(that._addRouteHandlers(handlers));

        //var duration = (+Date.now() - start);
        //env.printTrace('request routing', 'Duration (route request): ' + duration + 'ms', { duration: duration });
        
        env.argo._routedResponseHandler = handlers.response || null;

        if (handlers.request) {
          handlers.request(env, next);
        } else {
          next(env);
        }
      }
    }
    
    if (!env.argo._routed) {
      next(env);
    }
  };
};

Argo.prototype._routeResponseHandler = function(router) {
  var that = this;
  return function routeResponseHandler(env, next) {
    if (!env.argo._routed) {
      if (env.response.statusCode !== 405) {
        env.response.statusCode = 404;
      }

      next(env);
      return;
    }

    if (env.argo._routedResponseHandler) {
      //env.printTrace('response routing: (Cached)');
      env.argo._routedResponseHandler(env, next);
      return;
    } else if (env.argo._routedResponseHandler === null) {
      next(env);
      return;
    }

    /*var start = +Date.now();
    var search = env.request.routeUri || env.request.url;

    // clear this for outer route scope
    env.request.routeUri = null;

    for (var key in router) {
      if (search.search(key) != -1 &&
          (router[key][env.request.method.toLowerCase()] ||
           router[key]['*'])) {

        //var duration = (+Date.now() - start);
        //env.printTrace('response routing', 'Duration (route response): ' + duration + 'ms', { duration: duration });

        var method = env.request.method.toLowerCase();
        var fn = router[key][method] ? router[key][method] 
          : router[key]['*'];

        var handlers = new RouteHandlers();
        fn(that._addRouteHandlers(handlers));
        
        if (handlers.response) {
          handlers.response(env, next);
        } else {
          next(env);
        }
      }
    }*/
  };
};

Argo.prototype._route = function(router, handle) {
  handle('request', this._routeRequestHandler(router));
  handle('response', { hoist: true }, this._routeResponseHandler(router));
};

Argo.prototype._target = function(env, next) {
  if (env.response._headerSent) {
    next(env);
    return;
  }
  var start = +Date.now();

  if (env.target && env.target.url) {
    var options = {};
    options.method = env.request.method || 'GET';

    // TODO: Make Agent configurable.
    options.agent = new env.argo._http.Agent();
    options.agent.maxSockets = 1024;

    var parsed = url.parse(env.target.url);
    options.hostname = parsed.hostname;
    options.port = parsed.port || 80;
    options.path = parsed.path;

    options.headers = env.request.headers;
    options.headers['Connection'] = 'keep-alive';
    options.headers['Host'] = options.hostname;

    if (parsed.auth) {
      options.auth = parsed.auth;
    }

    var req = env.argo._http.request(options, function(res) {
      for (var key in res.headers) {
        var headerName = res._rawHeaderNames[key] || key;
        env.response.setHeader(headerName, res.headers[key]);
      }

      env.target.response = res;

      if (next) {
        var duration = (+Date.now() - start);
        //env.printTrace('target connection', 'Duration (target): ' + duration + 'ms', { duration: duration });
        next(env);
      }
    });

    req.end();
  } else {
    next(env);
  }
};

module.exports = function(_http) { return new Argo(_http) };
