var cors = require('./cors');
var argo = require('../');

var proxy = argo();

proxy
  .use(cors)
  .route('/weather/forecasts', require('./forecasts'))
  .listen(process.env.PORT || 3000);
