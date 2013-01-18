var argo = require('../');

argo()
  .use(function(addHandler) {
    addHandler('response', function(env, next) {
      if (env.response.statusCode === 404) {
        env.response.body = 'Not Found';
        env.response.headers['Content-Type'] = 'text/plain';
      }
      next(env);
    });
  })
  .route('/greeting', function(addHandler) {
    addHandler('request', function(env, next) {
      env.trace('greeting', function() {
        env.response.statusCode = 200;
        env.response.headers['Content-Type'] = 'text/plain';
        env.response.body = 'Hello world!';

        next(env);
      });
    });
  })
  .listen(8011);

