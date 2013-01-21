var argo = require('../');

argo()
  .target('https://stream.twitter.com')
  .listen(process.env.PORT || 3000);
