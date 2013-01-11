var argo = require('../');
var cors = require('./cors');
var oauth2 = require('../argo-oauth2-package');

var oauth = oauth2
  .configure(require('./oauthOptions'))
  .support('authorization_code', 'bearer');

var proxy = argo();

var port = process.env.PORT || 3000;

proxy
  .use(oauth)
  .use(cors)
  .route('/weather/forecasts', require('./forecasts'))
  .listen(port);

console.log('Listening on http://localhost:' + port);
