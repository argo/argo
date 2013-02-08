var assert = require('assert');
var http = require('http');
var argo = require('../');

var defaultEnv = { request: { headers: {} }, response: { headers: {} }, target: {} };

describe('Argo', function() {
  describe('ctor', function() {
    it('alters http.IncomingMessage.prototype', function() {
      argo();
      assert.ok(http.IncomingMessage.prototype._modifiedHeaderLine);
    });
  });
});

describe('IncomingMessage', function() {
  describe('#_addHeaderLine', function() {
    it('saves raw header names', function() {
      var incomingMessage = new http.IncomingMessage();
      incomingMessage._addHeaderLine('Super-Duper', 'funtime');
      assert.equal(incomingMessage._rawHeaderNames['super-duper'], 'Super-Duper');
    });
  });
});

describe('Argo', function() {
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
    it('delegates to Runner#listen', function() {
      var runner = require('../runner');
      var wasCalled = false;
      var _listen = runner.listen;

      runner.listen = function() {
        wasCalled = true;
      };

      argo().listen(1234);

      runner.listen = _listen;

      assert.ok(wasCalled);
    });
  });

  describe('#use', function() {
    describe('when using middleware', function() {
      it('delegates to Builder#use', function() {
        var server = argo();
        var wasCalled = false;

        var _use = server.builder.use;
        server.builder.use = function(middleware) {
          wasCalled = true;
        };

        server.builder.use(function(addHandler) {});

        server.builder.use = _use;

        assert.ok(wasCalled);
      });

      it('enqueues a middleware request handler', function() {
        var server = argo();
        var wasCalled = false;

        server.use(function(addHandler) {
          addHandler('request', function(env, next) {
            wasCalled = true;
          });
        });

        server.call(defaultEnv);

        assert.ok(wasCalled);
      });

      it('enqueues a middleware response handler', function() {
        var server = argo();
        var wasCalled = false;

        server.use(function(addHandler) {
          addHandler('response', function(env, next) {
            wasCalled = true;
          });
        });

        server.call(defaultEnv);

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
        .use(function(addHandler) {
          addHandler('request', function(env, next) {
            assert.equal(env.target.url, 'http://targeturl');
            done();
            next(env);
          });
        })
        .call(defaultEnv);
    });
  });

  describe('#route', function() {
    it('executes route handler on matched route', function(done) {
      defaultEnv.request.url = '/route';
      defaultEnv.request.method = 'GET';
      argo()
        .route('/route', function(addHandler) {
          addHandler('request', function(env, next) {
            assert.equal(env.request.url, '/route');
            done();
          });
        })
      .call(defaultEnv);
    });
  });

  describe('#map', function() {
    it('handles sub-routing', function(done) {
      defaultEnv.request.url = '/map/sub';
      defaultEnv.request.method = 'GET';

      argo()
        .map('/map', function(server) {
          server
            .route('/sub', function(addHandler) {
              addHandler('request', function(env, next) {
                assert.equal(env.request.url, '/map/sub');
                done();
                next(env);
              });
            });
        })
        .call(defaultEnv);
    });
  });
});
