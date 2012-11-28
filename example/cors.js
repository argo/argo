module.exports = function(handlers) {
  console.log('adding cors handlers');
  handlers.add('response', function(env, next) {
    console.log('executing cors response handler');
    env.response.setHeader('Access-Control-Allow-Origin', '*');

    next(env);
  });
};
