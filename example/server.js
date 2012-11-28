var platform = require('../');
var cors = require('./cors');

var proxy = platform.init(function(builder) {
  builder.use(cors);
});

proxy.route('/weather/forecasts', require('./forecasts'));

platform.run(proxy);
