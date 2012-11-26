var platform = require('./platform');
var DOMParser = require('xmldom').DOMParser;
var CORS = require('./cors');
var Matcher = require('./matcher');

var proxy = platform.init(function(gateway) {
  gateway.use(CORS);
  gateway.use(Matcher);
});

proxy.route('/weather/forecasts', function(handler) {
  console.log('adding forecast handlers');

  handler.on('request', function(env, next) {
    console.log('in route proxy request handler');

    var regex = /\/([0-9]+)\.json/;
    var result = regex.exec(env.proxy.pathSuffix);

    var woeid = result ? result[1] : '2467861' /* Palo Alto, CA */;

    env.target.url = 'http://weather.yahooapis.com/forecastrss?w=' + woeid;

    next(env);
  });

  handler.on('response', function(env, next) {
    console.log('in route proxy response handler');

    var body = '';
    env.target.response.on('data', function(chunk) {
      body += chunk;
    });
    
    env.target.response.on('end', function() {
      /*

       */
      var doc = new DOMParser().parseFromString(body);
      var response = JSON.stringify({
        location: { lat: 42.33, long: -83.05, name: "Detroit, MI" },
        timestamp: "Mon, 26 Nov 2012 1:52 pm EST",
        temp: 36,
        text: "Cloudy",
        "url": "http://weather.yahoo.com/forecast/USMI0229_f.html",
        "forecast": [
          {
            "date": "26 Nov 2012",
            "day": "Mon",
            "high": 37,
            "low": 23,
            "text": "Mostly Cloudy"
          },
          {
            "date": "27 Nov 2012",
            "day": "Tue",
            "high": 35,
            "low": 27,
            "text": "Partly Cloudy"
          }
        ]
      });

      env.response.setHeader('Content-Length', response.length); 
      env.response.end(response);
    });

    next(env);
  });
});

module.exports = proxy;
