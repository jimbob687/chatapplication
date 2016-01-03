var request = require('request');    // https://www.npmjs.com/package/request

/*
* Class to start a chat with another user
*/

module.exports = {

  requestAdminPermissions: function(jsessionID, adminIdList, callback) {
    // Query to check that an admin has permissions to chat with another user, might be several criteria, do they
    // belong to the same group, or if outside group, have they invited a user before

    var serverURL = _apiProtocol + "://" + _apiServerHostName + ":" + _apiServerPort + _inviteCheckPathApi;

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
      runChatStart(clientID, sessionID, socket, dataHash, function(err, returnHash) {

        if(!err) {
          // We have successfully created the chat so add the random hash to it
          returnHash["randomhash"] = randomHash;

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
function queryClientProfile(targetClientID, sessionID, callback) {

  try {

    _redismethods.fetchClientProfile(targetClientID, function(err, profileJson) {
      if(!err) {
        if(profileJson == null) {
          // nothing in redis so need to call the api
          _profileapi.queryClientProfileAPI(sessionID, targetClientID, function(err, profileJson) {
            if(!err) {
              if(profileJson == null) {
                // we have a problem at this point
                callback(true, null);
              }
              else {
                // let's add it to redis
                _redismethods.addClientProfile(targetClientID, profileJson, function(err, redisReply) {
                  if(err) {
                    logger.error("Error, unable to add profile to redis for clientID: " + targetClientID);
                  }
                  callback(false, profileJson);
                });
              }
            }
            else {
              logger.error("Error attempting to get profile for clientID: " + targetClientID + " from API");
              callback(true, null);
            }
          });
        }
        else {
          // profile has been taken from redis, so return it
          callback(false, profileJson);
        }
      }
      else {
        logger.error("Error attempting to fetch profile from redis for clientID: " + clientID);
        callback(true, null);
      }
    });

  }
  catch(e) {
    logger.error("Exception attempting to fetch profile for clientID: " + clientID);
    callback(true, null);
  }

}


/*
 * Function to get client profiles
 */
function grabClientProfiles(sessionID, permHash, callback) {

  try {

    var clientProfilesHash = {};
    var elementsFound = 1;   // number of keys that have been processed
    var permHashLen = Object.keys(permHash).length;    // get length of permHash

    // iterate the client hash
    for(var targetClientID in permHash) {
      logger.debug("About to get profile for clientID: " + targetClientID);
      queryClientProfile(targetClientID, sessionID, function(err, clientProfile) {
        elementsFound++;   // increment the number of object processed
        // let's get the client profile, first from redis, and api if not in redis
        if(!err) {
          clientProfilesHash[targetClientID] = JSON.parse(clientProfile);
          logger.debug("Client profile: " + clientProfile);
        }
        else {
          logger.error("Error, unable to get client profile for clientID: " + targetClientID);
        }
        if(elementsFound >= permHashLen) {
          // we have processed all the keys
          callback(false, clientProfilesHash);
        }
      });
    }

  }
  catch(e) {
    logger.error("Exception attempting to obtain client profiles " + e);
    callback(true, null);
  }

}



/*
 * Function to get client statuses from redis e.g. online, busy, offline etc
 */
function getClientStatus(permHash, callback) {

  try {
    logger.debug("In getClientStatus");

    var clientStatusHash = {};
    var elementsFound = 1;   // number of keys that have been processed
    var permHashLen = Object.keys(permHash).length;    // get length of permHash

    // fetchClientStatus: function(clientID, callback)
    for(var targetClientID in permHash) {
      logger.debug("Getting status for clientID: " + targetClientID);
      _redismethods.fetchClientStatus(targetClientID, function(err, clientStatus) {
        elementsFound++;   // increment the number of object processed
        if(!err) {
          logger.debug("Adding status of " + JSON.stringify(clientStatus) + " for clientID: " + targetClientID);
          clientStatusHash[targetClientID] = clientStatus;
        }
        else {
          logger.error("Error, unable to get client status for clientID: " + targetClientID);
        }
        if(elementsFound >= permHashLen) {
          // we have processed all the keys so return the hash
          callback(false, clientStatusHash);
        }
      });
    }

  }
  catch(e) {
    logger.error("Exception attempting to get client statuses " + e);
    callback(true, null);
  }

}


/**
 * Start a chat search
 * @sessionID  ID of the session
 * @socket     Socket that the connection is for
 * @dataHash   HashMap of the data
 */
function runChatStart(clientID, sessionID, socket, dataHash, callback) {

  var returnHash = {};

  var inviteeIdArray = [];    // list of admins to add to the chat
  if("inviteeid" in dataHash) {
    inviteeIdArray = dataHash.inviteeid;
  }

  // check that the admin has permission to add the invitees
  _startchat.requestAdminPermissions(sessionID, inviteeIdArray, function(apiErr, returndata) {
    if(!apiErr) {
      logger.info("Successful check requesting admin permissions");
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
                  returnHash["chatsessionid"] = chatSessionID;
                  grabClientProfiles(sessionID, permHash, function(err, clientProfilesHash) {
                    if(!err) {
                      returnHash["clientprofiles"] = clientProfilesHash;
                      getClientStatus(permHash, function(err, clientStatusHash) {
                        // get the client statuses
                        if(!err) {
                          returnHash["clientstatus"] = clientStatusHash;
                        }
                        else {
                          // log an error but proceed anyway
                          logger.error("Error atttempting to client statuses for chat sessioID: " + chatSessionID);
                          returnHash["clientstatus"] = {};     // put an empty hash in
                        }
                        callback(false, returnHash);
                      });
                    }
                    else {
                      logger.error("Error attempting to start chat when querying client profiles");
                      callback(true, null);
                    }

                  });
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


