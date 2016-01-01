var request = require('request');    // https://www.npmjs.com/package/request

/*
* Server to get user information off. Will make requests to the server and expect json in return
*/


module.exports = {

  queryAuthAPI: function(username, password, callback) {

    var serverURL = _apiProtocol + "://" + _apiServerHostName + ":" + _apiServerPort;

    var authURI = "/mytannfe/auth/AdminApiAuth.do";

    var formData = {form:{ username: username, password: password}}

    request.post(serverURL + _authPathApi, formData, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        logger.debug(body); 
        callback(false, JSON.parse(body));
      }
      else {
        logger.error("Error making request: " + body);
        callback(true, JSON.parse(body));
      }
    })
  },

  queryProfileAPI: function(jsessionID, callback) {
    // Query the profile for an admin using the jsessionid

    var serverURL = _apiProtocol + "://" + _apiServerHostName + ":" + _apiServerPort + _profilePathApi;

    //var authURI = "/mytannfe/auth/AdminApiAuth.do";

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


    request( { method: 'POST', url: serverURL, jar: j }, function (error, response, body) {
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
