var http = require('http');
var url = require('url');
var Builder = require('./builder');
var runner = require('./runner');

var Argo = function(_http) {
  this._router = {};
  this._routerKeys = [];
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

Argo.prototype._bufferBody = function(stream, parent, prop) {
  return function(callback) {
    if (parent[prop]) {
      callback(null, parent[prop]);
      return;
    }
    var buf = [];
    var len = 0;

    stream.on('data', function(chunk) {
      buf.push(chunk);
      len += chunk.length;
    });

    stream.on('end', function() {
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

      parent[prop] = body;

      callback(null, body);
    });
  };
};

Argo.prototype.embed = function() {
  this.buildCore();

  this.builder.run(this._target);
  this.builder.use(function(addHandler) {
    addHandler('response', { sink: true }, function(env) {
      if (env.argo.oncomplete) {
        env.argo.oncomplete(env);
      };
    });
  });

  return this.builder.build();
}

Argo.prototype.buildCore = function() {
  var that = this;

  that.builder.use(function(addHandler) {
    addHandler('request', function(env, next) {
      env.argo._http = that._http;
      next(env);
    });
  });

  var hasRoutes = false;
  for (var prop in that._router) {
    if (!hasRoutes && that._router.hasOwnProperty(prop)) {
      hasRoutes = true;
    }
  }

  if (hasRoutes) {
    that.builder.use(function addRouteHandlers(handlers) { 
     that._route(that._router, handlers);
    });
  }
};

Argo.prototype.build = function() {
  var that = this;

  that.buildCore();

  // spooler
  that.builder.use(function bufferRequest(handle) {
    handle('request', { hoist: true }, function(env, next) {
      env.getRequestBody = that._bufferBody(env.request, env, 'requestBody');
      next(env);
    });

    handle('response', { hoist: true }, function bufferResponse(env, next) {
      if (!env.target.response) {
        next(env);
        return;
      }

      env.getResponseBody = that._bufferBody(env.target.response, env, 'responseBody');
      next(env);
    });
  });

  that.builder.run(that._target);

  // response ender
  that.builder.use(function(handle) {
    handle('response', { sink: true }, function(env, next) {
      if (!env.responseBody && env.getResponseBody) {
        env.getResponseBody(function(err, body) {
          var body = body || '';
          env.response.setHeader('Content-Length', body.length); 
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end(body);
        });
        return;
      }
      var body = env.responseBody || '';
      env.response.setHeader('Content-Length', body.length); 
      env.response.writeHead(env.response.statusCode, env.response.headers);
      env.response.end(body);
    });
  });

  return that.builder.build();
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

  that._routerKeys.push(path);
  that._routerKeys.sort(function(a, b) {
    if (a.length > b.length) {
      return -1;
    } else if (a.length < b.length) {
      return 1;
    }

    return 0;
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

    var app = argo.embed();

    return function(addHandler) {
      addHandler('request', function mapHandler(env, next) {
        var oldRouted = env.argo._routed;
        env.argo._routed = false;

        var oldRoutedResponseHandler = env.argo._routedResponseHandler;
        env.argo._routedResponseHandler = null;

        if (env.request.url[env.request.url.length - 1] === '/') {
          env.request.url = env.request.url.substr(0, env.request.url.length - 1);
        }
        env.request.routeUri = env.request.url.substr(path.length) || '/';

        // TODO: See if this can work in a response handler here.
        env.argo.oncomplete = function(env) {
          env.argo._routed = oldRouted;
          env.argo._routedResponseHandler = oldRoutedResponseHandler;
          env.request.routeUri = null;
          next(env);
        };

        app(env);
      });
    };
  };

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
    var search = env.request.routeUri || env.request.url;

    var routerKey;
    if (search === '/' && that._router['/']) {
      routerKey = '/';
    } else {
      that._routerKeys.forEach(function(key) {
        if (!routerKey && key !== '*' && search.search(key) !== -1 && key !== '/') {
          routerKey = key;
        }
      });
    }

    if (!routerKey && that._router['*']) {
      routerKey = '*';
    }

    if (routerKey &&
        (!router[routerKey][env.request.method.toLowerCase()] &&
         !router[routerKey]['*'])) {
      env.response.statusCode = 405;
      next(env);
      return;
    }

    if (routerKey &&
        (router[routerKey][env.request.method.toLowerCase()] ||
         router[routerKey]['*'])) {
      env.argo._routed = true;

      var method = env.request.method.toLowerCase();
      var fn = router[routerKey][method] ? router[routerKey][method] 
        : router[routerKey]['*'];

      var handlers = new RouteHandlers();
      fn(that._addRouteHandlers(handlers));

      env.argo._routedResponseHandler = handlers.response || null;

      if (handlers.request) {
        handlers.request(env, next);
      } else {
        next(env);
        return;
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
      env.argo._routedResponseHandler(env, next);
      return;
    } else if (env.argo._routedResponseHandler === null) {
      next(env);
      return;
    }
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
        next(env);
      }
    });

    env.getRequestBody(function(err, body) {
      if (body) {
        req.write(body);
      }

      req.end();
    });
  } else {
    next(env);
  }
};

module.exports = function(_http) { return new Argo(_http) };
