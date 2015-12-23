var request = require('request');    // https://www.npmjs.com/package/request

/*
* Class to start a chat with another user
*/

module.exports = {

  requestAdminPermissions: function(jsessionID, adminIdList, callback) {
    // Query to check that an admin has permissions to chat with another user, might be several criteria, do they
    // belong to the same group, or if outside group, have they invited a user before

    var serverURL = apiServerConfig.protocol + "://" + apiServerConfig.serverhostname + ":" + 
					apiServerConfig.serverport + apiServerConfig.invitecheck;

    request.defaults({jar: true});
    if(requestConfig.verbose == true) {
      request.debug = true;
    }

    var j = request.jar();
    var cookieVal = "JSESSIONID=" + jsessionID;
    var cookie = request.cookie(cookieVal);
    var cookieHostName = apiServerConfig.protocol + "://" + apiServerConfig.serverhostname;
    j.setCookie(cookie, cookieHostName);
    /*
    if(requestConfig.verbose == true) {
      logger.info("apiServerConfig.serverhostname: " + apiServerConfig.serverhostname);
      logger.info("Cookie JAR: " + j.getCookieString(apiServerConfig.serverhostname));
    }
    */

    var formData = {};
    formData["adminlist"] = JSON.stringify(adminIdList);
    logger.debug("adminIdList: " + adminIdList);

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
          logger.error("Error making request: " + body + " with statusCode: " + response.statusCode);
        }
        callback(true, "Error");
      }
    })
  },


  checkAdminPermissions: function(adminPermHash, callback) {
    var permsOK = processAdminPermissions(adminPermHash);
    callback(permsOK);
  },


  processChatStart: function(sessionID, socket, dataHash, callback) {
    
    runChatStart(sessionID, socket, dataHash, function(err, returnData) {

      if(!err) {

      }
      else {

      }
    });
  }


}

/*
 * Function to check the permissions returned by a hash and returns a boolean if all permissions pass or not
*/
function processAdminPermissions(adminPermHash) {

  var allOK = true;  

  for(key in adminPermHash) {
    var thisPermHash = adminPermHash[key];
    if(!"permission" in thisPermHash || thisPermHash.permission != true) {
      allOK = false;
    }
  }
  return allOK;
}


/**
 * Function to add a new chat session to the db and return the chat sessionID
 * @sessionID    ID of the session
 * @clientID     ID of the client
 * @socket       Socket that the request came in on
 */
function addChatSessionDB(sessionID, clientID, socket, callback) {

  _dbmethods.insertConversation(clientID, function(err, chatSessionID) {
    if(!err) {
      // have started a chat
      console.log("Chat sessionID: " + chatSessionID);
      callback(false, chatSessionID);
    }
    else {
      // there is an error
      callback(true, "Unable to generate chat session");
    }
  });

}


/**
 * Start a chat search
 * @sessionID  ID of the session
 * @socket     Socket that the connection is for
 * @dataHash   HashMap of the data
 */
function runChatStart(sessionID, socket, dataHash, callback) {

  var inviteeIdArray = [];    // list of admins to add to the chat
  if("inviteeid" in dataHash) {
    inviteeIdArray = dataHash.inviteeid;
  }

  startchat.requestAdminPermissions(sessionID, inviteeIdArray, function(err, returndata) {
    if(!err) {
      logger.info("Not an error requesting admin permissions");
      var adminPermHash = null;
      if("perms" in returndata) {
        startchat.checkAdminPermissions(returndata.perms, function(permsOK) {
          if(permsOK) {
            logger.info("Perms are OK");
            if("clientid" in socket) {
              var clientID = socket.clientid;
              logger.info("clientID: " + clientID);
              addChatSessionDB(sessionID, clientID, socket, function(err, chatSessionData) {
                if(!err) {
                  callback(false, chatSessionData);
                }
                else {
                  callback(true, chatSessionData);
                }
              });
            }
            else {
              callback(true, "Unable to verify permissions");
            }
          }
          else {
            logger.info("Error, invalid client perms creating chat");
            io.emit('chatstartfail', "Invalid client");
            callback(true, "Unable to start chat session");
          }
        });
      }
      else {
        // can't find perms hash send back an error
        logger.error("Unable to find perms hash");
        callback(true, "Unable to start chat session");
      }
    }
    else {
      logger.info("Got an error checking chat permissions");
    }
  });

}


