var argo = require('../');
var cors = require('./cors');

var proxy = argo();
var port = process.env.PORT || 3000;

proxy
  .use(cors)
  .route('/weather/forecasts', require('./forecasts'))
  .listen(port);

console.log('Listening on http://localhost:' + port);
