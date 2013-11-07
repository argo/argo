var assert = require('assert');
var RegExpRouter = require('../regexp_router');

describe('RegExpRouter', function() {
  it('sets params as RegExp result', function() {
    var router = RegExpRouter.create();
    router.add('^/hello/([^\/]+)$', { methods: ['GET'] }, new Function() /* handleFn */);
    var result = router.find('/hello/world', 'GET');
    assert.equal(result.params[1], 'world');
  });

  it('returns a NotFound warning when route does not exist', function() {
    var router = RegExpRouter.create();
    router.add('^/hello$', { methods: ['GET'] }, new Function() /* handleFn */);
    var result = router.find('/goodbye', 'GET');
    assert.equal(result.warning, 'NotFound');
  });

  it('returns a MethodNotSupported warning when method does not exist', function() {
    var router = RegExpRouter.create();
    router.add('^/hello$', { methods: ['PUT'] }, new Function() /* handleFn */);
    var result = router.find('/hello', 'GET');
    assert.equal(result.warning, 'MethodNotSupported');
  });

  it('matches all routes when an asterisk is used', function() {
    var router = RegExpRouter.create();
    router.add('*', { methods: ['GET'] }, new Function() /* handleFn */);
    var result = router.find('/hello/there/buddy', 'GET');
    assert.ok(!result.warning);
  });

  it('matches all methods when an asterisk is used', function() {
    var router = RegExpRouter.create();
    router.add('^/hello$', { methods: ['*'] }, new Function() /* handleFn */);
    var result = router.find('/hello', 'OPTIONS');
    assert.ok(!result.warning);
  });

  it('can truncate a path with a RegExp prefix', function() {
    var router = RegExpRouter.create();
    var path = router.truncate('/hello/world', '^/hello');
    assert.equal(path, '/world');
  });

  it('ensures pattern matching starts at the beginning of the path when truncating', function() {
    var router = RegExpRouter.create();
    var path = router.truncate('/hello/world', '/hello');
    assert.equal(path, '/world');
  });

  it('gracefully returns the path when trying to truncate using an asterisk', function() {
    var router = RegExpRouter.create();
    var path = router.truncate('/hello/world', '*');
    assert.equal(path, '/hello/world');
  });

  it('removes `$` in regular expression syntax when actsAsPrefix is set', function() {
    var router = RegExpRouter.create();
    router.add('^/hello$', { actsAsPrefix: true }, new Function() /* handleFn */);
    var result = router.find('/hello/world', 'GET');
    assert.ok(!result.warning);
  });
});
