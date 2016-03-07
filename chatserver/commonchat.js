
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


  /*
  This is now deprecated, can't find it being used anywhere in the code
  grabClientProfilesArray: function(sessionID, clientIDarray, callback) {
    // Iterate an array of clientIDs and return the profiles for each
    try {
      var clientProfilesHash = {};
      var recordsReturned = 0;
      for(var i = 0; i < clientIDarray.length; i++) {
        grabClientProfile(sessionID, targetClientID, function(err, clientProfile) {
          recordsReturned++;
          if(!err) {
            clientProfilesHash[targetClientID] = clientProfile;
          }
          if(recordsReturned == clientIDarray.length) {
            // All the records have been returned
            callback(false, clientProfilesHash);
          }
        });
      }
    }
    catch(e) {
      logger.error("Exception attempting to iterate clientIDs for profiles: " + e);
      callback(true, null);
    }

  },
  */


  // Function to get client profiles
  getClientProfiles: function(sessionID, clientIDArray, callback) {

    try {

      logger.debug("In getClientProfiles");

      grabClientProfiles(clientIDArray, sessionID, function(err, returnProfileData) {
        if(!err) {
          logger.info("returnProfileData: " + returnProfileData);
          callback(err, returnProfileData);
        }
        else {
          callback(err, null);
        }
      });

    }
    catch(e) {
      logger.error("Exception attempting to obtain client profiles " + e + "\n" + e.stack);
      callback(true, null);
    }

  },


  getClientStatus: function(clientIDArray, callback) {

    //  Function to get client statuses from redis e.g. online, busy, offline etc
    try {
      logger.debug("In getClientStatus");

      //var clientStatusHash = {};
      //var elementsFound = 1;   // number of keys that have been processed
      //var permHashLen = Object.keys(permHash).length;    // get length of permHash

      grabClientStatuses(clientIDArray, function(err, returnStatusData) {
        if(!err) {
          logger.info("returnStatusData: " + JSON.stringify(returnStatusData));
          callback(err, returnStatusData);
        }
        else {
          callback(err, null);
        }
      });

    }
    catch(e) {
      logger.error("Exception attempting to get client statuses " + e +  " Exception: " + e.stack);
      callback(true, null);
    }

  }

}


function grabClientStatuses(clientIDArray, callback) {

  var asyncTasks = [];

  clientIDArray.forEach( function(targetClientID, index) {
    logger.debug("Need status for clientID:" + targetClientID);
    asyncTasks.push(
      function(callback){
        _redismethods.fetchClientStatus(targetClientID, function(err, clientStatus) {
          //elementsFound++;   // increment the number of object processed
          if(!err) {
            logger.debug("Async returned clientStatus of " + JSON.stringify(clientStatus) + " for clientID: " + targetClientID);
            //clientStatusHash[targetClientID] = clientStatus;
            callback(false, clientStatus);
          }
          else {
            logger.error("Error, unable to get client status for clientID: " + targetClientID);
            callback(true, null);
          }

        });
      }
    )
  });

  _async.parallel(asyncTasks, function(err, resultData) {
    // All tasks are done now
    //doSomethingOnceAllAreDone();
    logger.info("Have a result for client status of: " + JSON.stringify(resultData));
    callback(err, resultData);
  });

}


function grabClientProfiles(clientIDArray, sessionID, callback) {

  var asyncTasks = [];

  clientIDArray.forEach( function(targetClientID, index) {
    logger.debug("Need profile for clientID:" + targetClientID);
    asyncTasks.push(
      function(callback){

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
                      if(!err) {
                        logger.info("Async returned clientProfile of type: " + _Type(redisReply) + " and data: " + redisReply);
                        callback(false, JSON.parse(profileJson));
                      }
                      else {
                        logger.error("Error, unable to add profile to redis for clientID: " + targetClientID);
                        callback(false, null);
                      }

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
              logger.debug("client profileJson: " + profileJson);
              // profile has been taken from redis, so return it
              callback(false, profileJson);
            }
          }
          else {
            logger.error("Error attempting to fetch profile from redis for clientID: " + clientID);
            callback(true, null);
          }
        });

        /*
        //_profileapi.queryClientProfile(targetClientID, sessionID, function(err, clientProfile) {
        queryClientProfile(targetClientID, sessionID, function(err, clientProfile) {
          elementsFound++;   // increment the number of object processed
          // let's get the client profile, first from redis, and api if not in redis
          if(!err) {
            callback(false, clientProfile);
          }
          else {
            logger.error("Error, unable to get client profile for clientID: " + targetClientID);
            callack(true, null);
          }
        });
        */

      }
    )
  });

  _async.parallel(asyncTasks, function(err, resultData) {
    // All tasks are done now
    //doSomethingOnceAllAreDone();
    logger.info("Have a result for client profiles of: " + JSON.stringify(resultData));
    callback(err, resultData);
  });

}


/*
 * Has been deprecated to be replaced with an async module
 */
 /*
function grabClientProfile(sessionID, targetClientID, callback) {

  try {

    _profileapi.queryClientProfile(targetClientID, sessionID, function(err, clientProfile) {
      elementsFound++;   // increment the number of object processed
      // let's get the client profile, first from redis, and api if not in redis
      if(!err) {
        callback(false, clientProfile);
      }
      else {
        logger.error("Error, unable to get client profile for clientID: " + targetClientID);
        callack(true, null);
      }
    });



  }
  catch(e) {
     logger.error("Exception attempting to get client profile for clientID: " + targetClientID);
  }

}
*/


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
