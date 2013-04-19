module.exports = function(handle) {
  handle('response', function(env, next) {
    env.response.setHeader('Access-Control-Allow-Origin', '*');

    next(env);
  });
};
