var url = require('url');
var Stream = require('stream');
var path = require('path');
var environment = require('./environment');
var Frame = require('./frame');
var Builder = require('./builder');
var RegExpRouter = require('./regexp_router');
var assembler = require('./assembler')

var Argo = module.exports = function(/*server, router, builder,*/ extensions) {
  this.server = null;//server;
  this.router = null;//router;
  this.builder = null;//builder;
  this.container = null;
  this.extensions = extensions;
  this.packages = [];
};

Argo.prototype.init = function() {
  var self = this;
  this.extensions.forEach(function(extension) {
    if (extension.init && typeof extension.init === 'function') {
      extension.init.bind(extension)(self);
    }
  });
};

Argo.prototype.include = function(mod) {
  var name = mod.install(this.container);
  var ext = this.container.resolve(name);
  ext.init(this);
  this.packages.push(mod);
  return this;
};

Argo.prototype.listen = function(port) {
  var app = this.build();

  this.server.createServer(app.run).listen(port);

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
  return this.use(function(handler) {
    handler('request', function(env, next) {
      env.target.url = url + (env.request.url || '');
      next(env);
    });
  });
};

Argo.prototype.embed = function() {
  this.buildCore();

  this.builder.run(this._target);
  this.builder.use(function(handler) {
    handler('response', { affinity: 'sink' }, function(env, next) {
      if (env.argo.oncomplete) {
        env.argo.oncomplete(env);
      };
    });
  });

  return this.builder.build();
}

Argo.prototype.buildCore = function() {
  var that = this;

  that.builder.use(function(handler) {
    handler('request', { affinity: 'hoist' }, function(env, next) {
      //env.argo._http = that._http;
      if (!env.argo.currentUrl) {
        env.argo.currentUrl = env.request.url;
      }

      if (!env.argo.uri) {
        env.argo.uri = function() {
          var xfp = env.request.headers['x-forwarded-proto'];
          var protocol;

          if (xfp && xfp.length) {
            protocol = xfp.replace(/\s*/, '').split(',')[0];
          } else {
            protocol = env.request.connection.encrypted ? 'https' : 'http';
          }

          var host = env.request.headers['host'];

          if (!host) {
            var address = env.request.connection.address();
            host = address.address;
            if (address.port) {
              if (!(protocol === 'https' && address.port === 443) && 
                  !(protocol === 'http' && address.port === 80)) {
                host += ':' + address.port
              }
            }
          }

          return protocol + '://' + path.join(host, env.request.url);
        }
      }
      next(env);
    });
  });
};

Argo.prototype.build = function() {
  var that = this;

  that.buildCore();

  that.builder.run(that._target);

  // response ender
  that.builder.use(function(handle) {
    handle('response', { affinity: 'sink' }, function(env, next) {
      if (env.response.body) {
        var body = env.response.body;
        if (typeof body === 'string') {
          env.response.setHeader('Content-Length', body ? body.length : 0); 
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end(body);
        } else if (body instanceof Stream) {
          env.response.writeHead(env.response.statusCode, env.response.headers);
          body.pipe(env.response);
        } else if (body instanceof Buffer) {
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end(body);
        } else if (typeof body === 'object') {
          body = new Buffer(JSON.stringify(body), 'utf-8');
          if (!env.response.getHeader('Content-Type')) {
            env.response.setHeader('Content-Type', 'application/json; charset=UTF-8');
          }
          env.response.setHeader('Content-Length', body ? body.length : 0); 
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end(body.toString('utf-8'));
        }
      } else {
        var contentLength = env.response.getHeader('Content-Length');
        if (contentLength == '0') {
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end();
        } else if (env.target.response) {
          env.target.response.getBody(function(err, body) {
            env.response.setHeader('Content-Length', body ? body.length : 0); 
            env.response.writeHead(env.response.statusCode, env.response.headers);
            env.response.end(body);
          });
        } else {
          env.response.setHeader('Content-Length', '0'); 
          env.response.writeHead(env.response.statusCode, env.response.headers);
          env.response.end();
        }
      }
    });
  });

  var built = that.builder.build();
  built._pipeline = this._pipeline;

  var self = this;
  built.run = function(req, res) {
    var env = environment(self, req, res);
    built.flow(env);
  }

  return built;
};

Argo.prototype.call = function(env) {
  var app = this.build();
  return app.flow(env);
}

Argo.prototype.map = function(path, options, handler) {
  if (typeof(options) === 'function') {
    handler = options;
    options = {};
  }

  var that = this;
  function generateHandler(path, handler) {
    var container = assembler.assemble();

    var argo = container.resolve('argo.core');
    argo.init();

    //argo.router = that.router.create();

    handler(argo);

    var app = argo.embed();

    return function(handler) {
      console.log('map handler called');
      handler('request', function mapHandler(env, next) {
        env.argo.frames = env.argo.frames || [];
        
        var frame = new Frame();
        frame.routed = env.argo._routed;
        frame.routedResponseHandler = env.argo._routedResponseHandler;
        frame.targetUrl = env.target.url;

        env.argo._routed = false;
        env.argo._routedResponseHandler = null;
        env.target.url = null;

        if (env.argo.currentUrl[env.argo.currentUrl.length - 1] === '/') {
          env.argo.currentUrl = env.argo.currentUrl.substr(0, env.argo.currentUrl.length - 1);
        }

        frame.routeUri = path;

        var previousUrl = env.argo.currentUrl;
        env.argo.currentUrl = argo.router.truncate(env.argo.currentUrl, frame.routeUri) || '/';

        // TODO: See if this can work in a response handler here.
        
        if (env.argo.oncomplete) {
          frame.oncomplete = env.argo.oncomplete;
        }

        env.argo.currentFrame = frame;
        env.argo.frames.push(frame);

        env.argo.oncomplete = function(env) {
          var frame = env.argo.frames.pop();

          env.argo._routed = frame.routed;
          env.argo._routedResponseHandler = frame.routedResponseHandler;
          env.argo.currentUrl = previousUrl;
          env.argo.oncomplete = frame.oncomplete;
          env.target.url = frame.targetUrl;

          next(env);
        };

        console.log('pre-flow');
        app.flow(env);
      });
    };
  };

  console.log('returning this.route');
  this.route(path, options, generateHandler(path, handler));
  return this;
};

Argo.prototype._pipeline = function(name) {
  return this.builder.pipelineMap[name];
};
