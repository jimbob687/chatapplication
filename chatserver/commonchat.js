
/*
 * This module is for common methods, might change in the future
 */


module.exports = {


  // Function to do an autocomplete against a name, will call the api
  clientNameSearch: function(sessionID, dataHash, callback) {
    var term = null;
    if("term" in dataHash) {
      term = dataHash.term;
    }

    var randomHash = null;
    if("randomhash" in dataHash) {
      randomHash = dataHash.randomhash;
      logger.info("Have found randomHash: " + randomHash);
    }
    else {
      logger.error("Can't find randomHash in name search");
      callback(true, null);
    }

    _searchapi.searchClientNameAPI(sessionID, term, function(err, returndata) {
      logger.info("Callback has been completed err is: " + err);
      if(!err) {
        logger.debug("About to send an autocomplete response");
        var completeHash = {};
        completeHash['data'] = returndata;
        completeHash['randomhash'] = randomHash;  // add the randomHash to identify what request is for
        //io.emit('clientautocomplete', completeHash);
        callback(false, completeHash);
      }
      else {
        logger.error("Error attempting to do name search");
        callback(true, null);
      }
    });

  },


  // Function to get an admin's profile details and return a hash????
  processAdminProfile: function(sessionID, callback) {
    adminProfile(sessionID, function(err, clientJson) {
      if(!err) {
        callback(false, clientJson);
      }
      else {
        logger.error("Error attempting to get client information from api with msg: " + clientJson);
        callback(true, null);
      }

    });

  },

  // Function to get the clientID from a profile
  searchClientID: function(clientJson, callback) {
    findClientID(clientJson, function(err, clientID) {
      if(!err) {
        callback(false, clientID);
      }
      else {
        callback(true, null);
      }
    });
  },


  // Function to insert a session into the db
  insertDbSessionID: function(sessionID, clientID, callback) {

    dbmethods.insertChatSession(sessionID, clientID, function(err, chatsessionID) {
      if(!err) {
        logger.debug("Have inserted into db chatsessionID: " + chatsessionID);
        callback(false, chatsessionID);
      }
      else {
        logger.error("Error attempting to insert sessionID into db for clientID: " + clientID);
        callback(true, null);
      }
    });
  },




  //Get the profile information for a client. Will try redis first, if not in redis then query api and populate redis
  queryClientProfile: function(targetClientID, sessionID, callback) {

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

  },


  // Function to get client profiles
  grabClientProfiles: function(sessionID, permHash, callback) {

    try {

      var clientProfilesHash = {};
      var elementsFound = 1;   // number of keys that have been processed
      var permHashLen = Object.keys(permHash).length;    // get length of permHash

      // iterate the client hash
      for(var targetClientID in permHash) {
        logger.debug("About to get profile for clientID: " + targetClientID);
        _profileapi.queryClientProfile(targetClientID, sessionID, function(err, clientProfile) {
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

}


/*
 * Function to geet clientID from JSON that has been called from the api server
 */
function findClientID(clientJson, callback) {
  var clientID = null;
  if("sTarget_AdminID" in clientJson) {
    clientID = clientJson.sTarget_AdminID;
    // insert the session into the database
    callback(false, clientID);
  }
  else {
    callback(true, "clientID not found in clientJson");
  }

}


/*
 * Get the admin profile information
 * sessionID - is the JSESSIONID that we are making the query for
 * socket - is the socket that the request came in on, if is null then sessionID didn't come in on a socket
*/
function adminProfile(sessionID, callback) {

  _authapi.queryProfileAPI(sessionID, function(err, profileJson) {

    if (!err) {
      if(profileJson == null) {
        logger.error("Error, profileJson is null");
      }
      else {
        var adminJson = {};
        if("profile" in profileJson) {
          // get the profile in the Json
          clientJson = profileJson.profile;
          logger.debug("clientJson: " + JSON.stringify(clientJson));
          callback(false, adminJson);
        }
        else {
          callback(true, "Unable to find profile in return hash");
        }
      }
    }
    else {
      var errMsg = null;
      if("message" in profileJson) {
        errMsg = profileJson.message;
      }
      callback(true, errMsg);
    }

  });

}


