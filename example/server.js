var argo = require('../');
var cors = require('./cors');
var oauth2 = require('../argo-oauth2-package');
var oauthOptions = require('./oauthOptions');

var oauth = oauth2.createProvider(oauthOptions);

var proxy = argo();

var port = process.env.PORT || 3000;

proxy
  .use(oauth)
  .use(cors)
  .target('http://weather.yahooapis.com')
  .get('/weather/forecasts', require('./forecasts'))
  .listen(port);

console.log('Listening on http://localhost:' + port);
