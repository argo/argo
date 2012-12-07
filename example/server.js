var argo = require('../');
var cors = require('./cors');
var tracer = require('../tracer');

var proxy = argo();
var port = process.env.PORT || 3000;

proxy
  .use(tracer)
  .use(function(addHandler) {
    addHandler('request', function(env, next) {
      env.startTime = +Date.now();
      next(env);
    });
  })
  .use(cors)
  .route('/weather/forecasts', require('./forecasts'))
  .use(function(addHandler) {
    addHandler('response', function(env, next) {
      env.printTrace('total', 'Duration (total): ' + (+Date.now() - env.startTime) + 'ms');
      next(env);
    });
  })
  .listen(port);

console.log('Listening on http://localhost:' + port);
