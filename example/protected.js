var argo = require('../');
var cors = require('./cors');
var oauth2 = require('argo-oauth2-package');
var oauthOptions = require('./oauth_options');
var forecasts = require('./forecasts');

var oauth = oauth2.createProvider(oauthOptions);

argo()
  .use(oauth)
  .use(cors)
  .target('http://weather.yahooapis.com')
  .get('^/weather/forecasts(?:/(\\d+)(?=\.json)){0,1}', forecasts)
  .listen(process.env.PORT || 3000);

// Example: curl -i http://localhost:3000/weather/forecasts/2487889.json
