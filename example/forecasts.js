var DOMParser = require('xmldom').DOMParser;

module.exports = function(addHandler) {
  addHandler('request', function(env, next) {
    env.trace('forecast request', function() {
      var regex = /\/([0-9]+)\.json/;
      var result = regex.exec(env.proxy.pathSuffix);

      var woeid = result ? result[1] : '2467861' /* Palo Alto, CA */;
      env.target.url = 'http://weather.yahooapis.com/forecastrss?w=' + woeid;
    });

    next(env);
  });

  addHandler('response', function(env, next) {
    env.trace('forecast response', function() {
      var json = xmlToJson(env.response.body);
      env.response.body = JSON.stringify(json);
    });

    next(env);
  });
};

function xmlToJson(xml) {
  var channel  = new DOMParser().parseFromString(xml).documentElement.getElementsByTagName('channel')[0];
  var geo = 'http://www.w3.org/2003/01/geo/wgs84_pos#';
  var yweather = 'http://xml.weather.yahoo.com/ns/rss/1.0';

  var response = {};

  var lat = channel.getElementsByTagNameNS(geo, 'lat').item(0).firstChild;
  var long = channel.getElementsByTagNameNS(geo, 'long').item(0).firstChild;
  var location = channel.getElementsByTagNameNS(yweather, 'location').item(0);
  var city = location.getAttribute('city');
  var region = location.getAttribute('region');

  response.location = {
    lat: +(lat.nodeValue),
    long: +(long.nodeValue),
    name: city + ', ' + region
  };

  var condition = channel.getElementsByTagNameNS(yweather, 'condition').item(0);
  var date = condition.getAttribute('date');
  var temp = condition.getAttribute('temp');
  var text = condition.getAttribute('text');

  response.timestamp = date;
  response.temp = temp;
  response.text = text;

  var link = channel.getElementsByTagName('link').item(0).firstChild.nodeValue;
  var urls = link.split('*');
  response.url = urls[urls.length - 1];

  response.forecasts = [];

  var forecasts = channel.getElementsByTagNameNS(yweather, 'forecast');

  for(var i = 0, len = forecasts.length; i < len; i++) {
    var forecast = forecasts.item(i);
    response.forecasts.push({
      date: forecast.getAttribute('date'),
      day: forecast.getAttribute('day'),
      high: forecast.getAttribute('high'),
      low: forecast.getAttribute('low'),
      text: forecast.getAttribute('text')
    });
  }

  return response;
}
