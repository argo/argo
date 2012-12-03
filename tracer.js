module.exports = function(addHandler) {
  addHandler('request', function(env, next) {
    env.trace = function(name, cb) {
      var start = +Date.now();
      cb();
      var message = 'Duration (' + name + '): ' + (+Date.now() - start) + 'ms';
      console.log(new Date() + ': ' +  message);
    };

    next(env);
  });
};
