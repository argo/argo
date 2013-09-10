var https = require('https');

var Https = module.exports = function() {
  return https;
};

Object.keys(https).forEach(function(k) {
  if (typeof https[k] === 'function') {
    Https.prototype[k] = https[k].bind(https);
  } else {
    Https.prototype[k] = https[k];
  }
});

Https.install = function(container) {
  container.register({
    name: 'argo.https',
    id: 'argo.https.node',
    value: Https,
    params: []
  });
};
