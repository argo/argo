module.exports = function(addHandler) {
  console.log('adding cors handlers');
  addHandler('response', function(env, next) {
    console.log('executing cors response handler');
    env.response.setHeader('Access-Control-Allow-Origin', '*');

    next(env);
  });
};
