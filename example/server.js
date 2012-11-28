var cors = require('./cors');
var platform = require('../');

var proxy = platform();

proxy
  .use(cors)
  .route('/weather/forecasts', require('./forecasts'))
  .listen(process.env.PORT || 3000);
