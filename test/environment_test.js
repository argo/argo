var assert = require('assert');
var environment = require('../environment');
var proxy = require('../argo')();
var env;

describe('Environment', function() {
  before(function() {
    env = environment(proxy, {} /* req */, {} /* res */);
  });

  it('initializes with a request', function() {
    assert(env.request);
  });

  it('initializes with a response', function() {
    assert(env.response);
  });

  it('initializes with a pipeline', function() {
    assert(env.pipeline);
  });
});
