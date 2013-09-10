var assembler = require('./assembler');

var factory = module.exports = function() {
  var container = assembler.assemble();

  var argo = container.resolve('argo.core');
  argo.container = container;

  argo.init();

  return argo;
};

console.log(factory);
