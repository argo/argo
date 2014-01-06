var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var http = require('http');
var Stream = require('stream');
var argo = require('../');
var util = require('util');
var Environment = require('../environment');

function Request() {
  this.headers = {};
  this.chunks = [];
  Stream.Duplex.call(this);
}
util.inherits(Request, Stream.Duplex);

Request.prototype._read = function(size) {
  var chunk = this.chunks.length ? this.chunks.shift() : null;
  this.push(chunk);
};

Request.prototype._write = function(chunk, encoding, callback) {
  this.chunks.push(chunk);
  callback();
};

function Response() {
  this.headers = {};
  this.statusCode = 0;
  this.body = null;
  this.chunks = [];
  Stream.Duplex.call(this);
}
util.inherits(Response, Stream.Duplex);

Response.prototype._read = function(size) {
  var chunk = this.chunks.length ? this.chunks.shift() : null;
  this.push(chunk);
};

Response.prototype._write = function(chunk, encoding, callback) {
  this.chunks.push(chunk);
  callback();
};

Response.prototype.setHeader = function(k, v) {
  this.headers[k] = v;
};

Response.prototype.writeHead = function(s, h) {
  this.statusCode = s;
  this.headers = h;
}

Response.prototype.getHeader = function(k) {
  return this.headers[k];
};

Response.prototype.end = function(b) {
  this.body = b;
};

function _getEnv() {
  return { 
    request: new Request(),
    response: new Response(),
    target: {},
    argo: {}
  };
}

describe('Argo', function() {
  describe('ctor', function() {
    it('alters http.IncomingMessage.prototype', function() {
      argo(http);
      assert.ok(http.IncomingMessage.prototype._argoModified);
    });
  });

  describe('#include', function() {
    it('evaluates a package', function() {
      var mixin = {
        package: function(server) {
          return { 
            install: function() {
              server.mixin = true;
            }
          };
        }
      };

      var server = argo().include(mixin);
      
      assert.ok(server.mixin);
    });
  });

  describe('#listen', function() {
    it('calls http server listen', function(done) {
      var Http = function() {};
      Http.prototype.createServer = function() {
        return this;
      };

      Http.prototype.listen = function(port) {
        assert.equal(port, 1234);
        done();
      };

      var _http = new Http();
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.Agent = function() {};

      argo(_http).listen(1234);
    });

    it('can recieve more than just port as an argument', function(done) {
      var Http = function(){};
      Http.prototype.createServer = function() {
        return this;
      };

      Http.prototype.listen = function(port, hostname, backlog, cb) {
        assert.equal(port, 1234);
        assert.equal(hostname, "127.0.0.1");
        assert.equal(backlog, 511);
        assert.equal(typeof cb, "function");
        done();
      };

      var _http = new Http();
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.Agent = function() {};
      argo(_http).listen(1234, "127.0.0.1", 511, function(){});
    });
  });

  describe('#use', function() {
    describe('argo execution pipeline', function() {
      it('executes response handlers in reverse order', function(done) {
          var server = argo();
          var wasCalled = false;
          server
            .use(function(handle) {
              handle("response", function(env, next) {
                assert.equal(true, wasCalled);
                done();
              });
            })
            .use(function(handle) {
              handle("response", function(env, next) {
                wasCalled = true;
                next(env);
              });
            });
          server.call(_getEnv());
      });
    });
    describe('when using middleware', function() {
      it('delegates to Builder#use', function() {
        var server = argo();
        var wasCalled = false;

        var _use = server.builder.use;
        server.builder.use = function(middleware) {
          wasCalled = true;
        };

        server.builder.use(function(handle) {});

        server.builder.use = _use;

        assert.ok(wasCalled);
      });

      it('enqueues a middleware request handler', function() {
        var server = argo();
        var wasCalled = false;

        server.use(function(handle) {
          handle('request', function(env, next) {
            wasCalled = true;
          });
        });

        server.call(_getEnv());

        assert.ok(wasCalled);
      });

      it('enqueues a custom event middleware', function(){
        var server = argo();
        server.use(function(handle){
          handle('custom', function(env, next){
          });
        });
        server.call(_getEnv());
        assert.ok('custom' in server.builder.pipelineMap);
      });

      it('can access custom pipelines using _pipeline', function(){
        var server = argo();
        server.use(function(handle){
          handle('custom', function(env, next){
          });
        });
        server.call(_getEnv());
        var pipe = server._pipeline('custom');
        assert.ok(typeof pipe !== "undefined");
      });

      it('enqueues a middleware response handler', function() {
        var server = argo();
        var wasCalled = false;

        server.use(function(handle) {
          handle('response', function(env, next) {
            wasCalled = true;
          });
        });

        server.call(_getEnv());

        assert.ok(wasCalled);
      });
    });

    describe('when using a package', function() {
      it('delegates to #include', function() {
        var server = argo();
        var wasCalled = false;

        var _include = server.include;
        server.include = function() {
          wasCalled = true;
        };

        server.use({ package: function() { return { install: function() {} }; } });

        server.include = _include;

        assert.ok(wasCalled);
      });
    });
  });

  describe('#target', function() {
    it('sets env.target.url', function(done) {
      argo()
        .target('http://targeturl')
        .use(function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.target.url, 'http://targeturl');
            done();
            //next(env);
          });
        })
        .call(_getEnv());
    });
  });

  describe('#route', function() {
    it('executes route request handler on matched route', function(done) {
      var env = _getEnv();
      env.request.url = '/route';
      env.request.method = 'GET';
      argo()
        .route('^/route$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.url, '/route');
            done();
          });
        })
      .call(env);
    });

    it('executes route response handler on matched route', function(done) {
      var env = _getEnv();
      env.request.url = '/route';
      env.request.method = 'GET';

      argo()
        .route('^/route$', function(handle) {
          handle('response', function(env, next) {
            assert.equal(env.request.url, '/route');
            done();
          });
        })
      .call(env);
    });

    it('executes the next handler in the pipeline when no route handler exists', function(done) {
      var env = _getEnv();
      env.request.url = '/rout3';
      env.request.method = 'GET';

      argo()
        .use(function(handle) {
          handle('response', function(env, next) {
            assert.equal(env.request.url, '/rout3');
            done();
          });
        })
        .route('^/route$', function(handle) {
        })
        .call(env);
    });

    it('skips over multiple routes that are chained together', function(done){
      var env = _getEnv();
      env.request.url = '/goodbye';
      env.request.method = 'GET';

      argo()
        .get('^/hello$', function(handle){})
        .get('^/goodbye$', function(handle){
          assert.equal(env.request.url, '/goodbye');
            done();
        })
        .call(env);
    });

    it('returns first known match', function(done) {
      var env = _getEnv();
      env.request.url = '/route/that/does/not/match/first';
      env.request.method = 'GET';

      argo()
        .route('^/route/.*', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.url, '/route/that/does/not/match/first');
            done();
          });
        })
        .route('^/route/that/does/not/match/first', function(handle) { })
      .call(env);
    });

    it('returns / match on root request', function(done) {
      var env = _getEnv();
      env.request.url = '/';
      env.request.method = 'GET';

      argo()
        .route('^/route$', function(handle) { })
        .route('^/$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.url, '/');
            done();
          });
        })
      .call(env);
    });

    it('returns 404 when no match exists', function(done) {
      var env = _getEnv();
      env.request.url = '/404';
      env.request.method = 'GET';

      argo()
        .use(function(handle) {
          handle('response', function(env, next) {
            assert(env.response.statusCode, 404);
            done();
          });
        })
        .route('^/$', function(handle) { })
      .call(env);
    });

    it('returns wildcard when no match exists', function(done) {
      var env = _getEnv();
      env.request.url = '/404';
      env.request.method = 'GET';

      argo()
        .route('*', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.url, '/404');
            done();
          });
        })
        .route('^/$', function(handle) { })
      .call(env);
    });

    it('executes routes after request middleware regardless of order they are added to pipeline', function(done) {
      var env = _getEnv();
      env.request.url = '/match';
      env.request.method = 'GET';

      argo()
        .route('/match', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.test, 'success');
            done();
          });
        })
        .use(function(handle) {
          handle('request', function(env, next) {
            env.test = 'success';
            next(env);
          });
        })
      .call(env);
    });

    it('executes routes even when a target has been set', function(done) {
      var env = _getEnv();
      env.request.url = '/match';
      env.request.method = 'GET';

      argo()
        .use(function(handle) {
          handle('request', function(env, next) {
            env.test = 'success';
            next(env);
          });
        })
        .route('/match', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.test, 'success');
            done();
          });
        })
        .target('http://abracadabra')
      .call(env);
    });

    it('executes routes response handlers only once on multiple route definitions', function(done) {
      var env = _getEnv();
      env.request.url = '/match';
      env.request.method = 'GET';

      argo()
        .use(function(handle) {
          handle('request', function(env, next) {
            env.count = 0;
            next(env);
          });
          handle('response', function(env, next) {
            assert.equal(env.count, 1);
            done();
          });
        })
        .get('/match', function(handle) {
          handle('response', function(env, next) {
            env.count++;
            next(env);
          });
        })
        .get('/nomatch', function(handle) {
          handle('request', function(env, next) {
            next(env);
          });
        })
        .call(env);
    });
  });

  describe('#map', function() {
    describe('sub-routing', function() {
      it('executes the route without a trailing slash', function(done) {
        var env = _getEnv();
        env.request.url = '/map/sub';
        env.request.method = 'GET';

        argo()
          .map('^/map', function(server) {
            server
              .route('^/sub$', function(handle) {
                handle('request', function(env, next) {
                  assert.equal(env.argo.currentUrl, '/sub');
                  assert.equal(env.request.url, '/map/sub');
                  done();
                  next(env);
                });
              });
          })
          .call(env);
      });

      it('executes the route without a trailing slash with multiple maps', function(done) {
        var env = _getEnv();
        env.request.url = '/map/map2/sub';
        env.request.method = 'GET';

        argo()
          .map('^/map', function(server) {
            server
              .map('^/map2', function(serverTwo){
                serverTwo.route('^/sub$', function(handle) {
                  handle('request', function(env, next) {
                    assert.equal(env.argo.currentUrl, '/sub');
                    assert.equal(env.request.url, '/map/map2/sub');
                    done();
                    next(env);
                  });
                });
              })
          })
          .call(env);
      });

      it('executes the route with a trailing slash', function(done) {
        var env = _getEnv();
        env.request.url = '/map/sub/';
        env.request.method = 'GET';

        argo()
          .map('^/map', function(server) {
            server
              .route('^/sub$', function(handle) {
                handle('request', function(env, next) {
                  assert.equal(env.argo.currentUrl, '/sub');
                  assert.equal(env.request.url, '/map/sub/');
                  done();
                  next(env);
                });
              });
          })
          .call(env);
      });
    });
  });

  describe('request buffering', function() {
    it('responds to error events', function(done){
      var env = _getEnv();
      env.request = new Request();
      env.target.response = new Response();
      env.response = new Response();

      var _http = {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.Agent = function() {};

      argo(_http)
        .use(function(handle) {
          handle('response', function(env, next) {
            env.request.getBody(function(err, body) {
              assert.equal(err.message, 'Test!');
              done();
            });
          });
        })
        .call(env);

      env.request.emit('error', new Error("Test!"));
      env.request.read(0);
    });

    it('caches body after retrieval', function(done){
      var env = _getEnv();
      env.request = new Request();
      env.target.response = new Response();
      env.response = new Response();

      var _http = {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.Agent = function() {};

      var app = argo(_http)
        .use(function(handle) {
          handle('response', function(env, next) {
            env.request.getBody(function(err, body) {
              env.request.getBody(function(err, body) {
                assert.equal(body.toString(), env.request.body.toString());
                done();
              });
            });
          });
        });

      env.request.write(new Buffer('Hello '));
      env.request.write(new Buffer('Buffered '));
      env.request.write(new Buffer('Request!'));
      env.request.end();
      
      app.call(env);
    });

    it('only buffers once', function(done) {
      var env = _getEnv();
      env.request = new Request();
      env.target.response = new Response();
      env.response = new Response();

      var _http = {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.Agent = function() {};

      var app = argo(_http)
        .use(function(handle) {
          handle('response', function(env, next) {
            env.request.getBody(function(err, body) {
              assert.equal(body.toString(), 'Hello Buffered Request!');
              done();
            });
          });
        });

      env.request.write('Hello ');
      env.request.write('Buffered ');
      env.request.write('Request!');
      env.request.end();
      
      app.call(env);
    });
    describe('when emitting Buffers', function() {
      it('returns a full representation of the request body', function(done) {
        var env = _getEnv();
        env.request = new Request();

        var _http = {};
        _http.IncomingMessage = Request;
        _http.ServerResponse = Response;
        _http.Agent = function() {};

        var app = argo(_http)
          .use(function(handle) {
            handle('request', function(env, next) {
              env.request.getBody(function(err, body) {
                assert.equal(body.toString(), 'Hello Buffered Request!');
                done();
              });
            });
          });

        env.request.write(new Buffer('Hello '));
        env.request.write(new Buffer('Buffered '));
        env.request.write(new Buffer('Request!'));
        env.request.end();
      
        app.call(env);
      });
    });

    describe('when emitting Strings', function() {
      it('returns a full representation of the request body', function(done) {
        var env = _getEnv();
        env.request = new Request();

        var _http = {};
        _http.IncomingMessage = Request;
        _http.ServerResponse = Response;
        _http.Agent = function() {};

        var app = argo(_http)
          .use(function(handle) {
            handle('request', function(env, next) {
              env.request.getBody(function(err, body) {
                assert.equal(body.toString(), 'Hello Buffered Request!');
                done();
              });
            });
          });

        env.request.write('Hello ');
        env.request.write('Buffered ');
        env.request.write('Request!');
        env.request.end();
      
        app.call(env);
      });
    });
  });

  describe('response buffering', function() {
    it('only buffers once', function(done) {
      var env = _getEnv();
      env.target.response = new Response();
      env.response = new Response();

      var _http = {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.Agent = function() {};

      var app = argo(_http)
        .use(function(handle) {
          handle('response', function(env, next) {
            env.target.response.getBody(function(err, body) {
              assert.equal(body.toString(), 'Hello Buffered Response!');
              done();
            });
          });
        });

        env.target.response.write('Hello ');
        env.target.response.write('Buffered ');
        env.target.response.write('Response!');
        env.target.response.end();
      
        app.call(env);
    });

    describe('when emitting Buffers', function() {
      it('returns a full representation of the response body', function(done) {
        var env = _getEnv();
        env.target.response = new Response();
        env.response = new Response();

        var _http = {};
        _http.IncomingMessage = Request;
        _http.ServerResponse = Response;
        _http.Agent = function() {};

        var app = argo(_http)
          .use(function(handle) {
            handle('response', function(env, next) {
              env.target.response.getBody(function(err, body) {
                assert.equal(body.toString(), 'Hello Buffered Response!');
                done();
              });
            });
          })

        env.target.response.write(new Buffer('Hello '));
        env.target.response.write(new Buffer('Buffered '));
        env.target.response.write(new Buffer('Response!'));
        env.target.response.end();

        app.call(env);
      });
    });
    
    describe('when emitting Strings', function() {
      it('returns a full representation of the response body', function(done) {
        var env = _getEnv();
        env.target.response = new Response();
        env.response = new Response();

        var _http = {};
        _http.IncomingMessage = Request;
        _http.ServerResponse = Response;
        _http.Agent = function() {};

        var app = argo(_http)
          .use(function(handle) {
            handle('response', function(env, next) {
              env.target.response.getBody(function(err, body) {
                assert.equal(body.toString(), 'Hello Buffered Response!');
                done();
              });
            });
          });

        env.target.response.write('Hello ');
        env.target.response.write('Buffered ');
        env.target.response.write('Response!');
        env.target.response.end();
      
        app.call(env);
      });
    });
  });

  describe('response ender', function() {
    it('sets a response body when env.response.body is empty', function(done) {
      var env = _getEnv();
      env.target.response = new Response();
      env.response = new Response();
      env.response.setHeader = function() {};
      env.response.getHeader = function(header) {
        if (header.toLowerCase() === 'content-length') {
          return 'Horticulture Fancy'.length.toString();
        }
      };
      env.response.writeHead = function() {};
      env.response.end = function(body) {
        assert.equal(body, 'Horticulture Fancy');
        done();
      };

      var app = argo();

      env.target.response.write('Horticulture Fancy');
      env.target.response.end();
    
      app.call(env);
    });
  });

  describe('#get', function() {
    it('responds to a GET request', function(done) {
      var env = _getEnv();
      env.request.method = 'GET';
      env.request.url = '/sheep';

      argo()
        .get('^/sheep$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.method, 'GET');
            done();
          });
        })
        .call(env);
    });
  });

  describe('#post', function() {
    it('responds to a POST request', function(done) {
      var env = _getEnv();
      env.request.method = 'POST';
      env.request.url = '/sheep';

      argo()
        .post('^/sheep$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.method, 'POST');
            done();
          });
        })
        .call(env);
    });
  });

  describe('#put', function() {
    it('responds to a PUT request', function(done) {
      var env = _getEnv();
      env.request.method = 'PUT';
      env.request.url = '/sheep';

      argo()
        .put('^/sheep$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.method, 'PUT');
            done();
          });
        })
        .call(env);
    });
  });

  describe('#del', function() {
    it('responds to a DELETE request', function(done) {
      var env = _getEnv();
      env.request.method = 'DELETE';
      env.request.url = '/sheep';

      argo()
        .del('^/sheep$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.method, 'DELETE');
            done();
          });
        })
        .call(env);
    });
  });
  
  describe('#head', function() {
    it('responds to a HEAD request', function(done) {
      var env = _getEnv();
      env.request.method = 'HEAD';
      env.request.url = '/sheep';

      argo()
        .head('^/sheep$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.method, 'HEAD');
            done();
          });
        })
        .call(env);
    });
  });

  describe('#options', function() {
    it('responds to a OPTIONS request', function(done) {
      var env = _getEnv();
      env.request.method = 'OPTIONS';
      env.request.url = '/sheep';

      argo()
        .options('^/sheep$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.method, 'OPTIONS');
            done();
          });
        })
        .call(env);
    });
  });


  describe('#trace', function() {
    it('responds to a TRACE request', function(done) {
      var env = _getEnv();
      env.request.method = 'TRACE';
      env.request.url = '/sheep';

      argo()
        .trace('^/sheep$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.method, 'TRACE');
            done();
          });
        })
        .call(env);
    });
  });

  describe('#run', function() {
    it('works as a request listener', function(done) {
      var proxy = argo()
        .get('^/sheep$', function(handle) {
          handle('request', function(env, next) {
            assert.equal(env.request.token, 'worked');
            done();
          });
        })
        .build()

      var request = { method: 'GET', url: '/sheep', token: 'worked' };
      var response = {};

      proxy.run(request, response);
    });
  });

  describe('method routing', function() {
    it('returns a 405 Method Not Allowed on unsupported methods', function(done) {
      var env = _getEnv();
      env.request.method = 'POST';
      env.request.url = '/sheep';
      env.response.writeHead = function(status, headers) {
        assert.equal(status, 405);
        done();
      };

      argo()
        .get('^/sheep$', function(handle) { })
        .call(env);
    });
  });

  describe('request proxying', function() {
    it('passes through if response headers have already been sent', function(done) {
      var env = _getEnv();
      env.request.method = 'GET';
      env.request.url = '/proxy';
      env.response._headerSent = true;

      var _http = function() {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.Agent = function() {};

      argo(_http)
        .use(function(handle) {
          handle('response', function(env, next) {
            assert.ok(!env.target.response);
            done();
          });
        })
        .target('http://argotest')
        .call(env);
    });

    it('forwards requests to a target', function(done) {
      var env = _getEnv();
      env.request.method = 'GET';
      env.request.url = '/proxy';

      var _http = function() {};
      _http.Agent = function() {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.request = function(options, callback) {
        assert.equal(options.method, 'GET');
        assert.equal(options.hostname, 'argotest');
        assert.equal(options.headers['Host'], 'argotest');
        assert.equal(options.path, '/proxy');
        assert.equal(options.auth, 'argo:rocks');

        return {
          write: function(str) {
            assert.equal(str, 'body');
            done();
          },
          end: function() {},
          on: function() {}
        };
      };

      var app = argo(_http)
        .target('http://argo:rocks@argotest');

      env.request.write('body');
      env.request.end();

      app.call(env);
    });


    it('targets a proxy only once', function(done) {
      var env = _getEnv();
      env.request.url = '/map';
      env.request.method = 'GET';

      var count = 0;

      var _http = function() {};
      _http.Agent = function() {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.request = function(options, callback) {
        count++;
        var res = new Response();
        callback(res);
        return {
          write: function() {},
          end: function() {},
          on: function() {}
        };
      };

      argo(_http)
        .use(function(handle) {
          handle('response', function(env, next) {
            assert.equal(count, 1);
            done();
            next(env);
          });
        })
        .map('/map', function(proxy) {
          proxy
            .target('http://proxy');
        })
        .target('http://argo')
        .call(env);
    });

    it('copies raw headers to the response', function(done) {
      var env = _getEnv();

      env.request.method = 'GET';
      env.request.url = '/proxy';
      env.response.setHeader = function(name, value) {
        if (name.toLowerCase() === 'x-stuff') {
          assert(name, 'X-Stuff');
        }
      };
      env.response.body = 'proxied!';

      var _http = function() {};
      _http.Agent = function() {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.request = function(options, callback) {
        var res = new Response();
        res._rawHeaderNames = { 'x-stuff': 'X-Stuff' };
        res.headers = { 'X-Stuff': 'yep' };
        callback(res);
        return { end: done, on: function() {} };
      };

      argo(_http)
        .target('http://google.com')
        .call(env);
    });

    it('sets the status code to 503 on target error', function(done) {
      var env = _getEnv();

      env.request.method = 'GET';
      env.request.url = '/proxy';
      env.response.body = 'proxied!';

      var _http = function() {};
      _http.Agent = function() {};
      _http.IncomingMessage = Request;
      _http.ServerResponse = Response;
      _http.request = function(options, callback) {
        var req = new EventEmitter();
        var end = function() {
          req.emit('error', new Error('fake error'));
        };

        return {
          end: end,
          on: req.on.bind(req),
          socket: { destroy: function() {} }
        };
      };

      argo(_http)
        .use(function(handle) {
          handle('response', function(env, next) {
            assert.equal(env.response.statusCode, 503);
            done();
          });
        })
        .target('http://google.com')
        .call(env);
    });
  });

  describe('response serving', function() {
    it('serves streams', function(done) {
      var env = _getEnv();
      env.request = new Request();
      env.request.url = '/hello';
      env.request.method = 'GET';
      env.response = new Response();

      var test = '';
      env.response.write = function(chunk) {
        test += chunk.toString();
      };

      env.response.end = function() {
        assert.equal('Hello, World!', test);
        done();
      };

      var stream = new Stream();
      stream.data = true;

      argo()
        .get('^/hello$', function(handle) {
          handle('request', function(env, next) {
            env.response.statusCode = 200;
            env.response.headers['Content-Type'] = 'text/plain';
            env.response.body = stream;
            next(env);
          });
        })
        .call(env);

      stream.emit('data', 'Hello, World!');
      stream.emit('end');
    });

    it('serves stringified JSON objects', function(done) {
      var env = _getEnv();
      env.request = new Request();
      env.request.url = '/hello';
      env.request.method = 'GET';
      env.response = new Response();

      env.response.end = function(body) {
        assert.equal('application/json; charset=UTF-8', env.response.getHeader('Content-Type'));
        assert.equal('{"hello":"World"}', body);
        done();
      };

      argo()
        .get('^/hello$', function(handle) {
          handle('request', function(env, next) {
            env.response.statusCode = 200;
            env.response.body = { hello: 'World' };
            next(env);
          });
        })
        .call(env);
    });

    it('serves serves an empty response when the Content-Length is 0', function(done) {
      var env = _getEnv();
      env.request = new Request();
      env.request.url = '/hello';
      env.request.method = 'GET';
      env.response = new Response();

      env.response.end = function(body) {
        assert.ok(!body);
        done();
      };

      argo()
        .get('^/hello$', function(handle) {
          handle('request', function(env, next) {
            env.response.statusCode = 200;
            env.response.headers['Content-Length'] = 0;
            next(env);
          });
        })
        .call(env);
    });
  });

  describe('error handling', function() {
    it('captures state on exception', function(done) {
      var env = _getEnv();
      env.request = new Request();
      env.request.url = '/yo';
      env.request.method = 'GET';
      env.response = new Response();

      var server = argo()
        .use(function(handle) {
          handle('error', function(env, error, next) {
            assert.equal(env.token, 'TADA!');
            done();
          });
        })
        .get('^/yo$', function(handle) {
          handle('request', function(env, next) {
            env.token = 'TADA!';
            throw new Error('KAPOW!');
          });
        });

      process.nextTick(function() {
        server.call(env);
      });
    });
  });
});
