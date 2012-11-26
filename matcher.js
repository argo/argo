/*module.exports = function(env, next) {
  console.log('in matcher');
  var regex = /\/([0-9]+)\.json/;
  var result = regex.exec(env.proxy.pathSuffix);

  if (result) {
    var woeid = result[1];

    env.woeid = woeid;
  }

  return next.call(env);
};*/


module.exports = function(handler) {
  console.log('adding matcher handlers');
  handler.on('request', function(env, next) {
    console.log('in matcher');
    console.log(env.proxy);
    var regex = /\/([0-9]+)\.json/;
    var result = regex.exec(env.proxy.pathSuffix);

    if (result) {
      var woeid = result[1];

      env.woeid = woeid;
    }

    next(env);
  });
};
