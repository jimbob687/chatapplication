
module.exports = {

  setKeepalive: function(clientID, clientType, clientStatus, callback) {
    /*
     * Function to track keepalive of clients
     * Add a keepalive to redis, clientType will be:
     *    - browser - redis key is "kabr:<clientid>"
     *    - mobile  - redis key is "kamo:<clientid>"
     * This record will expire after a certain amount of time so we need to get a constant keepalive value coming in
     *
     * Redis key to track status of client, this is global for the client no matter what device they are on
     *      - clstat
     *            Valid values are   'online', 'busy', 'offline'
     * Client needs to change this status themselves explicitly
     * This value is persistent in db and placed in redis with a timeout, for a client to be seen as online, still require having valid keepalive in the db
     */

    var clientKey = null;

    if(clientType == "browser") {
      clientKey = _keepaliveBrowserKey + ":" + clientID;
    }
    else if(clientType == "mobile") {
      clientKey = _keepaliveMobileKey + ":" + clientID;
    }
    else {
      logger.error("Error, unrecognized client type: " + clientType + " processing keepalive for clientID: " + clientID);
      callback(true, "Unrecognized client type");
    }

    var clientStatePersist = null;
    // This is the persistent storage of the client status (although does expire and redraws from db)
    var clientStateKey = _persistentStatusKey + ":" + clientID;

    _redisclient.get(clientStateKey, function(err, clientStatePersist) {
      if(!err) {
        logger.debug("Client status is: " + clientStatePersist + " for clientID: " + clientID);
        if(clientStatePersist == null) {
          // we need to query the persistent state from the db
          fetchClientStateDB(clientID, clientStateKey, function(err, returnClientStatePersist) {
            if(!err) {
              clientStatePersist = returnClientStatePersist;
            }
            else {
              logger.error("Error attempting to get and set state for clientID: " + clientID + " from db");
            }
          });
        }
      }
      else {
        logger.error("Error attempting to get the persistent client key from redis for clientID: " + clientID);
      }
    });


    if(clientStatePersist != null) {
      // set the keepalive key in redis using the persistent state
      _redisclient.set(clientKey, clientStatePersist, function(err, reply) {
        if(!err) {
          logger.info("Reply from redis: " + reply);
        }
        else {
          logger.error("Error trying to get keepalive from redis");
        }
      });
      // now set the key to expire
      _redisclient.expire(clientKey, _maxkeepalivetime, function(err, expireReply) {
        if(err) {
          logger.error("Error attempting to set expire time for clientID: " + clientID + " keepalive");
        }
      });
    }

    if(clientStatePersist != null) {
      callback(false, null);
    }
    else {
      callback(true, null);
    }

  },



  fetchClientStatus: function(clientID, callback) {
    /*
     * Get the current status of a client from redis
     * Will get the state for browser and mobile
     * Will return a hash with the status for each browser and mobile
     */

    try {

      var returnHash = {};

      returnHash["clientid"] = clientID;

      var clientKeyBr = _keepaliveBrowserKey + ":" + clientID;   // status for browser
      var clientMobBr = _keepaliveMobileKey + ":" + clientID;   // status for mobile

      _redisclient.get(clientKeyBr, function(err, reply) {
        // get status for browser
        if(!err) {
          if(reply != null) {
            returnHash['browser'] = reply;
          }
          else {
            returnHash['browser'] = "offline";
          }

          _redisclient.get(clientMobBr, function(err, reply) {
            // get status for mobile
            if(!err) {
              if(reply != null) {
                returnHash['mobile'] = reply;
              }
              else {
                returnHash['mobile'] = "offline";
              }
              callback(false, returnHash);
            }
            else {
              logger.error("Error attempting to get the mobile state of clientID: " + clientID + " from redis");
              returnHash['mobile'] = "unknown";
              callback(false, returnHash);
            }
          });

        }
        else {
          logger.error("Error attempting to get the browser state of clientID: " + clientID + " from redis");
          returnHash['browser'] = "unknown";
          finalState = "unknown";
          callback(false, returnHash);
        }
      });

    }
    catch(e) {
      logger.error("Exception attempting to get status for clientID: " + clientID + " from redis. " + e);
      callback(true, null);
    }

  },


  addClientProfile: function(clientID, profileJson, callback) {

    /*
     * Add a client's profile into redis.
     * This is used to cache client profiles.
     */

    try {
      logger.debug("About to add object type: " + _Type(profileJson) + " for clientID: " + clientID + " of type: " + _Type(clientID) + " client JSON to redis: " + profileJson);

      var clientProfKey = _clientProfileKey + ":" + clientID;   // key for a client profile in redis

      // set the keepalive key in redis using the persistent state
      //_redisclient.set(clientProfKey, JSON.stringify(profileJson), function(err, reply) {
      _redisclient.set(clientProfKey, profileJson, function(err, reply) {
        if(!err) {
          logger.debug("Reply from redis: " + reply);
          // get the new random expire time
          var newRandomExpireTime = getRandomTime(_clientProfileExpireTime);
          // now set the key to expire
          _redisclient.expire(clientProfKey, newRandomExpireTime, function(err, expireReply) {
            if(err) {
              logger.error("Error attempting to set profile expire time for clientID: " + clientID);
            }
            // callback that there wasn't an error
            callback(false, null);
          });
        }
        else {
          logger.error("Error trying to get set client profile in redis for clientID: " + clientID + " error: " + reply);
          callback(true, null);
        }
      });

    }
    catch(e) {
      logger.error("Exception attempting to set profile for clientID: " + clientID + " in redis. " + e);
      callback(true, null);
    }

  },


  fetchClientProfile: function(clientID, callback) {
    /*
     * Get a client's profile from redis. If it doesn't exist then return null.
     */

    try {
      var returnJson = null;

      var clientProfKey = _clientProfileKey + ":" + clientID;   // key for a client profile in redis

      logger.debug("About to get profile from redis for clientID: " + clientID + " and key: " + clientProfKey);

      _redisclient.get(clientProfKey, function(err, reply) {
        if(!err) {
          // send back response, will be null if key doesn't exist
          if(reply == null) {
            callback(false, null);
          }
          else {
            //var thisProf = JSON.parse(reply);
            logger.info("Data returned: " + _Type(reply) + " profile JSON: " + reply);
            callback(false, reply);
            //callback(false, JSON.parse(reply).toString());
          }
        }
        else {
          logger.error("Error attempting to get the profile for clientID: " + clientID + " from redis. Error: " + reply);
          callback(true, null);
        }
      });

    }
    catch(e) {
      logger.error("Exception attempting to get status for clientID: " + clientID + " from redis. " + e);
      callback(true, null);
    }

  }



}


/*
 * Function to set the client state in redis being the persistent key
 */
function setClientStateRedis(clientID, clientStateKey, clientStatePersist, callback) {

  try {

    _redisclient.set(clientStateKey, clientStatePersist, function(err, persistReply) {
      if(!err) {
        if(persistReply == "OK") {
          _redisclient.expire(clientStateKey, _maxpersiststatustime, function(err, _persistExpireReply) {
            // set the expiry of the key in redis
            if(err) {
              logger.error("Error attempting set the expire time for the persistent client state for clientID: " + clientID);
            }
          });
          callback(false);
        }
        else {
          logger.error("Error attempting to set the persistent state for clientID: " + clientID + " in redis, OK was not returned");
          callback(true);
        }
      }
      else {
        logger.error("Error attempting to set the persistent state for clientID: " + clientID + " in redis");
        callback(true);
      }
    });

  }
  catch(e) {
    logger.error("Exception attempting to add the persistent client state for clientID: " + clientID + " to redis");
    callback(true);
  }
}


/*
 * Function to add persistent client state to db, will call the dbmethods function
 */
function setClientStateDB(clientID, clientStatePersist, callback) {

  try {

    _dbmethods.updateClientState(clientID, clientStatePersist, function(err, returnData) {
      if(!err) {
        callback(false, null);
      }
      else {
        logger.error("Error attempting to add persistent client state to db for clientID: " + clientID);
        callback(true, null);
      }

    });

  }
  catch(e) {
    logger.error("Exception attempting to add the persistent client state to db for clientID: " + clientID + ". " + e);
    callback(true, null);
  }

}


/*
 * Function to get the client state from the db and then set it in redis for the persistent key
 */
function fetchClientStateDB(clientID, clientStateKey, callback) {

  try {

    var clientStatePersist = null;

    _dbmethods.queryClientState(clientID, function(err, clientStateRows) {
      if(!err) {
        logger.debug("Not error retrieving data for persistent client state for clientID: " + clientID);
        if(clientStateRows.length == 0) {
          logger.debug("Querying db for clientID: " + clientID + " persistent state no records returned");
          // nothing came back from db, so need to set the db record to online which is the default
          clientStatePersist = "online";
          // And add to the db
          setClientStateDB(clientID, clientStatePersist, function(err, dbInsertReturnData) {
            if(err) {
              logger.error("Error attempting to add the persistent client state to the db for clientID: " + clientID);
            }
          });
        }
        else if(clientStateRows.length > 0) {
          logger.debug("Querying db for clientID: " + clientID + " persistent state records returned: " + clientStateRows.length);
          // get the results from the db result set
          if(clientStateRows.length > 1) {
            logger.error("Error, received: " + clientStateRows.length + " from db querying client state when only max one should be returned");
          }

          var resultRow = clientStateRows[0];
          if("clientstate" in resultRow) {
            // grab the value from the db
            clientStatePersist = resultRow.clientstate;
            logger.debug("Clientstate: " + clientStatePersist + " for clientID: " + clientID);
          }
          else {
            logger.error("Error, clientstate is not in return row for clientID: " + clientID);
          }

        }

        if(clientStatePersist != null) {
          // add the persistent client state to redis
          setClientStateRedis(clientID, clientStateKey, clientStatePersist, function(err) {
            if(err) {
              logger.error("Error attempting to add persistent client state to redis for clientID: " + clientID);
            }
            else {
              callback(false, clientStatePersist);
            }
          });
        }
        else {
          logger.error("Error, unable to determine persistent client status for clientID: " + clientID + " to place into redis");
          callback(true, null);
        }
      }
      else {
        logger.error("Error attempting to query persistent client state from db for clientID: " + clientID);
        callback(true, null);
      }
    });

  }
  catch(e) {
    logger.error("Exception attempting to query and set the client state in the db for clientID: " + clientID + ". " + e);
    callback(true, null);
  }

}



/*
 * Function to take the redis expire time and randomize it by up to 1/20th adding or subtracting the amount
 */
function getRandomTime(expireTime) {

  // get 1/20th of expire time
  var fractionExp = expireTime/20;

  // Get a random number between 1 and the fractionExp
  var randomExpireTime = Math.floor(Math.random() * fractionExp) + 1;

  if(randomExpireTime < 0) {
    // make a positive number
    randomExpireTime = randomExpireTime * -1;
  }

  logger.debug("ExpireTime randomized by: " + randomExpireTime);

  var randomMod = randomExpireTime % 2;

  if(randomMod == 0) {
    // is an even number so subtract
    return (expireTime - randomExpireTime);
  }
  else if(randomMod == 1) {
    // is an odd so add
    return (expireTime + randomExpireTime);
  }
  else {
    logger.error("Error, unable to determine random expire time");
    // just return what there is
    return expireTime;
  }

}
