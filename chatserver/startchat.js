var request = require('request');    // https://www.npmjs.com/package/request

/*
* Class to start a chat with another user
*/

module.exports = {

  requestAdminPermissions: function(jsessionID, adminIdList, callback) {
    // Query to check that an admin has permissions to chat with another user, might be several criteria, do they
    // belong to the same group, or if outside group, have they invited a user before

    var serverURL = _apiProtocol + "://" + _apiServerHostName + ":" + 
					_apiServerPort + _inviteCheckPathApi;

    request.defaults({jar: true});
    if(requestConfig.verbose == true) {
      request.debug = true;
    }

    var j = request.jar();
    var cookieVal = "JSESSIONID=" + jsessionID;
    var cookie = request.cookie(cookieVal);
    var cookieHostName = _apiProtocol + "://" + _apiServerHostName;
    j.setCookie(cookie, cookieHostName);
    /*
    if(requestConfig.verbose == true) {
      logger.info("_apiServerHostName: " + _apiServerHostName);
      logger.info("Cookie JAR: " + j.getCookieString(_apiServerHostName));
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
    if(permsOK) {
      // Perms are OK, so return the permHash
      callback(false, adminPermHash);
    }
    else {
      // The perms aren't ok
      callback(true, null);
    }
  },


  processChatStart: function(clientID, sessionID, socket, dataHash, callback) {

    var randomHash = null;
    if("randomhash" in dataHash) {
      randomHash = dataHash.randomhash;
    
      // Start processing the chat
      runChatStart(clientID, sessionID, socket, dataHash, function(err, chatSessionID) {

        if(!err) {
          // We have successfully created the chat
          var returnHash = {};
          returnHash["randomhash"] = randomHash;
          returnHash["chatsessionid"] = chatSessionID;
          callback(false, returnHash);
        }
        else {
          // The chat was not successfully created
          callback(true, null);
        }
      });
    }
    else {
      logger.error("Error, unable to create chat for clientID: " + clientID + " as the randomhash is missing");
      callback(true, null);
    }
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
function addChatSessionDB(clientID, permHash, callback) {

  _dbmethods.insertConversation(clientID, permHash, function(err, chatSessionID) {
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



/*
 * Query the DB to see if there is an existing chat session for clients
 */
function queryChatSessionDB(clientID, permHash, callback) {

  try {

    _dbmethods.searchConversation(clientID, permHash, function(err, returnData, recordsFound) {

      if(!err) {
        if(returnData != null && recordsFound == 1) {
          if("conversationID" in returnData) {
            var conversationID = returnData["conversationID"];
            logger.debug("Returning conversationID: " + conversationID + " to clientID: " + clientID);
            callback(false, conversationID);
          }
          else {
            logger.error("Error, have request for chat session for clientID: " + clientID + " found record in DB but no conversationID. Result: " + JSON.stringify(returnData));
            callback(true, null);
          }

        }
        else if(recordsFound == 0) {
          // need to create a chat session as none exists at the moment
          addChatSessionDB(clientID, returndata.perms, function(err, chatSessionID) {
            if(!err) {
              callback(false, chatSessionID);
            }
            else {
              callback(true, chatSessionID);
            }
          });

        }
        else if(recordsFound > 1) {
           // we have an error, there should only be a single record returned, probably needs to be cleaned up
          if("conversationID" in returnData) {
            var conversationID = returnData["conversationID"];
            logger.debug("Returning conversationID: " + conversationID + " to clientID: " + clientID);
            callback(false, conversationID);
          }
          else {
            logger.error("Error, have request for chat session for clientID: " + clientID + " found record in DB but no conversationID");
            callback(true, null);
          }

        }

      }
      else {
        logger.error("Error attempting to query chat session for clientID: " + clientID);
        callback(true, null);

      }
    });

  }
  catch(e) {
    logger.error("Exception attempting to query chat session for clientID: " + clientID + ". " + e);
    callback(true, null);
  }

}


/*
 * Get the profile information for a client. Will try redis first, if not in redis then query api and populate redis
 */
function fetchClientProfile(targetClientID, sessionID) {

  try {

    _redismethods.fetchClientProfile(targetClientID, function(err, profile) {
      if(!err) {
        if(profileJson == null) {
          // nothing in redis so need to call the api
          _profileapi.queryClientProfileAPI(sessionID, targetClientID, function(err, profileJson) {
            if(!err) {
              if(profileJson == null) {
                // we have a problem at this point
              }
              else {
                // let's add it to redis
                _redismethods.addClientProfile(targetClientID, profileJson, function(err, redisReply) {

                });
              }
            }
            else {

            }
          });
        }
        else {

        }
      }
      else {

      }
    });

  }
  catch(e) {

  }

}


/**
 * Start a chat search
 * @sessionID  ID of the session
 * @socket     Socket that the connection is for
 * @dataHash   HashMap of the data
 */
function runChatStart(clientID, sessionID, socket, dataHash, callback) {

  var inviteeIdArray = [];    // list of admins to add to the chat
  if("inviteeid" in dataHash) {
    inviteeIdArray = dataHash.inviteeid;
  }

  // check that the admin has permission to add the invitees
  _startchat.requestAdminPermissions(sessionID, inviteeIdArray, function(apiErr, returndata) {
    if(!apiErr) {
      logger.info("Not an error requesting admin permissions");
      if("perms" in returndata) {
        _startchat.checkAdminPermissions(returndata.perms, function(err, permHash) {
          if(!err) {
            // The client hash permissions to add other clients to the chat
            logger.debug("Perm Hash: " + permHash);
            logger.info("Perms are OK");
            if("clientid" in socket) {
              var clientID = socket.clientid;
              logger.info("clientID: " + clientID);

              queryChatSessionDB(clientID, permHash, function(err, chatSessionID) {
                if(!err) {
                  callback(false, chatSessionID);
                }
                else {
                  callback(true, null);
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


