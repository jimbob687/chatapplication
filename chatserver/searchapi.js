var request = require('request');    // https://www.npmjs.com/package/request

/*
* Server to perform api searches
*/

module.exports = {

  searchClientNameAPI: function(jsessionID, term, callback) {
    // Query for a client name and details, most often used when searching for clients to chat with

    var serverURL = _apiProtocol + "://" + _apiServerHostName + ":" + _apiServerPort + _clientSearchPathApi;

    request.defaults({jar: true});
    if(requestConfig.verbose == true) {
      request.debug = true;
    }

    var j = request.jar();
    var cookieVal = "JSESSIONID=" + jsessionID;
    var cookie = request.cookie(cookieVal);
    var cookieHostName = _apiProtocol + "://" + _apiServerHostName;
    j.setCookie(cookie, cookieHostName);
    if(requestConfig.verbose == true) {
      logger.info("_apiServerHostName: " + _apiServerHostName);
      logger.info("Cookie JAR: " + j.getCookieString(_apiServerHostName));
    }

    var formData = {};
    formData["optype"] = "autocomplete";
    formData["adminTerm"] = term;

    request( { method: 'POST', url: serverURL, jar: j, form: formData }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        if(requestConfig.verbose == true) {
          logger.debug(body) // Print the response
        }
        callback(false, JSON.parse(body));
      }
      else if( response.statusCode == 302) {
        if(requestConfig.verbose == true) {
          logger.debug("Redirect has been generated, need to log user in");
        }
        callback(true, { "authenticated" : false, "statuscode": response.statusCode });
      }
      else {
        if(requestConfig.verbose == true) {
          logger.error("Error making request: " + body);
        }
        callback(true, JSON.parse(body));
      }
    })
  }

}
