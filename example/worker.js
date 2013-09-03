module.exports = function(server) {
  server
    .get('^/explode$', function(handle) {
      handle('request', function(env, next) {
        env.token = 'yippee!'
        throw new Error('Ahoy!');
      });
    })
    .get('^/$', function(handle) {
      handle('request', function(env, next) {
        env.response.body = 'Hello World!';
        next(env);
      });
    });
};
