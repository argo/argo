module.exports = function(addHandler) {
  addHandler('response', function(env, next) {
    env.trace('CORS', function() {
      env.response.setHeader('Access-Control-Allow-Origin', '*');
    });

    next(env);
  });
};
