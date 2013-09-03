var argo = require('../');
var cors = require('./cors');

argo()
  .use(cors)
  .get('^/outer$', function(handle) {
    handle('request', function(env, next) {
      env.response.body = 'Outer scope!';
      next(env);
    });
  })
  .map('^/web', function(web) {
    web 
      .use(function(handle) {
        handle('response', function(env, next) {
          env.response.setHeader('X-Stuff', 'Yep');
          next(env);
        });
      })
      .get('^/greeting/([^\/]+)$', function(handle) {
        handle('request', function(env, next) {
          console.log(env.request.params);
          var name = env.request.params[1];
          env.response.body = 'Hello, ' + name;
          next(env);
        }); 
      });
  })
  .listen(process.env.PORT || 3000);
