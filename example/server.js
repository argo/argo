var argo = require('../');
var cors = require('./cors');

var proxy = argo();

proxy
  .use(cors)
  .route('/weather/forecasts', require('./forecasts'))
  .listen(process.env.PORT || 3000);
