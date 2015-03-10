var assert = require('assert');
var http = require('http');
var argo = require('../');

describe('IncomingMessage', function() {
  describe('#_addHeaderLine', function() {
    it('saves raw header names', function() {
      argo();

      var incomingMessage = new http.IncomingMessage();
      var dest = {};
      incomingMessage._addHeaderLine('Super-Duper', 'funtime', dest);
      assert.equal(incomingMessage._rawHeaderNames['super-duper'], 'Super-Duper');
      //node 0.12 changes this private http API to include a destination object
      //this assertion is only valid for that particular node version.
      var destKeys = Object.keys(dest);
      if(destKeys.length) {
        assert.equal(dest['super-duper'], 'funtime');
      } 
    });
  });
});
