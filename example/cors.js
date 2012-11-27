/*module.exports = function(env, next) {
  env.response.setHeader('Access-Control-Allow-Origin', '*');
  return next.call(env);
};*/

module.exports = function(handler) {
  console.log('adding cors handlers');
  handler.on('response', function(env, next) {
    console.log('executing cors response handler');
    env.response.setHeader('Access-Control-Allow-Origin', '*');

    next(env);
  });
};
