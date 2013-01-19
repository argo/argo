var argo = require('../');

argo()
  .get('/', function(addHandler) {
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

