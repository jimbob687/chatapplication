var request = require('request');    // https://www.npmjs.com/package/request

/*
* Server to get client information. Will make requests to the server and expect json in return
*/


module.exports = {

  queryClientProfileAPI: function(jsessionID, targetClientID, callback) {
    // Query the profile for a client that doesn't belong to the client that we are querying on behalf of
    // Must have a valid jsessionID

    var serverURL = _apiProtocol + "://" + _apiServerHostName + ":" + _apiServerPort + _profilePathApi;

    request.defaults({jar: true});
    if(requestConfig.verbose == true) {
      request.debug = true;
    }


    var formData = {form:{ targetclientid: targetClientID }}

    var j = request.jar();
    var cookieVal = "JSESSIONID=" + jsessionID;
    var cookie = request.cookie(cookieVal);
    var cookieHostName = _apiProtocol + "://" + _apiServerHostName;
    j.setCookie(cookie, cookieHostName);
    if(requestConfig.verbose == true) {
      logger.info("_apiServerHostName: " + _apiServerHostName);
      //logger.info("Cookie JAR: " + j.getCookieString(_apiServerHostName));
    }

    request( { method: 'POST', url: serverURL, form: formData, jar: j }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        if(requestConfig.verbose == true) {
          logger.debug(body) // Print the response
        }
        callback(false, body);
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
