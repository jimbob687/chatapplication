
/*
 * This module is designed to handle incoming socket requests 
 *
 * A socket should have the following properties
 * clientid - ID of the client
 * jsessionid - cookie related to the socket
 */


/* Hash of the socket connections, key is the clientID and value is the socket object
 *   value is an hash with 
 *       - key is the jsessionid
 *       - value is a hash with keys:-
 *           sessionid - is the jsessionID associated with the socket
 *           expire - when the session will expire, timestamp in ms
 *           socket - value is a socket object
 */
global.socketClientHash = {};


// Hash of the socket connections, key is the JSESSIONID and value is the clientID
// e.g. { JSESSIONID1: 6576, JSESSIONID2: 9845 }
global.socketSessionHash = {};

module.exports = {

  startSocket: function(io, http) {

    io.on('connection', function(socket) {
      logger.debug('a user connected');

      socket.on('data', function(dataHash, jsessionID) {
        logger.info("dataHash: " + JSON.stringify(dataHash));

        if(socket == null) {
          logger.error("Error, socket is null in data");
        }

        // Adapted from the following link to be able to send a cookie thru when connecting. 
        // http://stackoverflow.com/questions/4753957/socket-io-authentication
        if("clientid" in socket) {
          logger.info("clientid of socket: " + socket.clientid);
          processData(sessionID, socket, dataHash);
          checkJsessionID(socket, jsessionID);
        }
        else {
          logger.debug("Socket doesn't have a clientid so need to get from the db");
          //searchSessionID(jsessionID, socket, dataHash, processData);
          adminProfile(sessionID, socket, function(err, returndata) {
            if(!err) {
              processData(sessionID, socket, dataHash);
            }
            else {
              // This is an error, need to return some sort of error
            }
          });
        }

      });
 

      socket.on('clientlookup', function(dataHash, jsessionID) {
        logger.info("Have just got an autocomplete request: " + JSON.stringify(dataHash));
        checkJsessionID(socket, jsessionID);
        _commonchat.clientNameSearch(jsessionID, dataHash, function(err, completeHash) {
          if(!err) {
            io.emit('clientautocomplete', completeHash);
          }
          else {
            // Need to add an error message to this to send back to client
          }
        });
      });


      socket.on('chatcreate', function(dataHash, jsessionID) {
        logger.info("Have just got a chat create request: " + JSON.stringify(dataHash));
        if(socket == null) {
          logger.error("Error, socket is null in chatcreate");
        }
        checkJsessionID(socket, jsessionID);
        if("clientid" in socket) {
          //clientNameSearch(jsessionID, socket, dataHash);
          startchat.processChatStart(jsessionID, socket, dataHash);
        }
        else {
          adminProfile(jsessionID, socket, function(err, returndata) {
            if(!err) {
              logger.info("Don't have error, so moving on");
              // create a chatsessionID for the chat room
              processData(jsessionID, socket, dataHash);
            }
            else {
              // need to return an error
            }
          });
        }
      });


      socket.on('disconnect', function(){
        logger.debug('user disconnected');
        socket.clientid = null;
      });

    });

  },


  // Function to add a session to a hash
  addSessionToHash: function(sessionID, socket, clientID, callback) {
    var addSuccess = addSocketClientHash(sessionID, socket, clientID);
    if(addSuccess) {
      callback(false, null);
    }
    else {
      callback(true, null);
    }
  },

  deleteSessionFromHash: function(sessionID, clientID, callback) {
    var deleteSuccess = remoteSocketClientHash(jsessionID, clientID);
    if(deleteSuccess) {
      callback(false, null);
    }
    else {
      callback(true, null);
    }
  }

}


/*
 * Function to check the jsessionID associated with a socket and update if required, as well as the hash's
 */
function checkJsessionID(socket, jsessionID) {
  if("clientid" in socket && socket.clientid != null) {
    // socket has a clientid associated with it
    var clientID = socket.clientid;
    if('jsessionid' in socket) {
      if(jsessionID != null && jsessionID !== undefined) {
        if(socket.jessionid != jsessionID) {
          logger.debug("Updating jsessionID for client socket");
          socket.jessionid = jsessionID;
          // remove the session from the addSocketClientHash hash
          var deleteSuccess = remoteSocketClientHash(jsessionID, clientID);
          // add the session to the addSocketClientHash hash
          var addSuccess = addSocketClientHash(jsessionID, socket, clientID);
        }
      }
      else {
        // clear the jsessionid from the hash
        delete socketSessionHash[socket.jessionid];
        // clear the jsessionid from the socket
        socket.jessionid = null;
        // delete the record from the addSocketClientHash hash
        var deleteSuccess = remoteSocketClientHash(jsessionID, clientID);
      }

    }
    else {
      // need to add the jsessionid to the socket if it exists
      if(jsessionID != null) {
        socketSessionHash[jsessionID] = clientID;  // remove from the hash
        logger.debug("Adding jsessionID to socket");
        socket.jessionid = jsessionID;
        // Add the session to the addSocketClientHash hash
        var addSuccess = addSocketClientHash(jsessionID, socket, clientID);
      }
    }
  }
}



/*
 * Function to add a session record to the socketClientHash
 * Returns a boolean if the add was successful or not
 */
function addSocketClientHash(sessionID, socket, clientID) {

  // build a hash for the client, get the existing hash if it exists
  var clientHash = {};
  if(clientID in socketClientHash) {
    clientHash = socketClientHash[clientID];
  }

  var sessionExpire = Math.floor(Date.now() / 1000) + sessionConfig.maxagesecs;

  var sessionHash = {};
  sessionHash["socket"] = socket;
  sessionHash["expire"] = sessionExpire;
  sessionHash["sessionid"] = sessionID;


  clientHash[sessionID] = sessionHash;

  socketClientHash[clientID] = clientHash;   // add to the hash

  //logger.debug("Added to socketClientHash for clientID: " + clientID + " hash: " + JSON.stringify(sessionHash));
  logger.debug("Added to socketClientHash for clientID: " + clientID);

  return true;  
}


/*
 * Function to remove a session record for a client from the hash, used of a session is disconnected or expires
 * Returns a boolean if the delete was successful or not
 */
function remoteSocketClientHash(sessionID, clientID) {
  if(clientID in socketClientHash) {
    var clientHash = socketClientHash[clientID];
    if(sessionID in clientHash) {
      delete clientHash[sessionID];
      socketClientHash[clientID] = clientHash;   // add to the hash
      logger.debug("Removed sessionID from Hash: " + JSON.stringify(clientHash));
    }
  }

  return True;
}




/*
 * Get the admin profile information
 * sessionID - is the JSESSIONID that we are making the query for
 * socket - is the socket that the request came in on, if is null then sessionID didn't come in on a socket
*/
function adminProfile(sessionID, socket, callback) {

  _authapi.queryProfileAPI(sessionID, function(err, profileJson) {

    if(socket == null) {
      logger.error("Socket is null at top of method");
    }

    if (!err) {
      if(profileJson == null) {
        logger.error("Error, profileJson is null");
      }
      else {
        var adminJson = {};
        if("profile" in profileJson) {
          // get the profile in the Json
          adminJson = profileJson.profile;
          logger.debug("adminJson: " + JSON.stringify(adminJson));
        }
        var clientID = null;
        if("sTarget_AdminID" in adminJson) {
          clientID = adminJson.sTarget_AdminID;
          // insert the session into the database
          insertDbSessionID(sessionID, clientID, function(err, chatsessionID) {
            if(!err) {
              logger.debug("Need to update hash for chatsessionID: " + chatsessionID + " and clientID: " + clientID);

              if(clientID !== null) {
                // add the sessionID to the hash
                socketSessionHash[sessionID] = clientID;

                if(socket != null) {
                  socket.clientid = clientID;   // Set the clientID on the socket
                  /*
                  socketconn.addSessionToHash(sessionID, socket, clientID, function(err, addHashData) {
                    if(!err) {
                     // here if we want to do something in the future
                    }
                    else {
                      logger.error("Error attempting to update socketClientHash for clientID: " + clientID);
                    }
                  });
                  */

                  var addSuccess = addSocketClientHash(sessionID, socket, clientID);
                  if(!addSuccess) {
                    logger.error("Error attempting to update socketClientHash for clientID: " + clientID);
                  }

                }
                else {
                  logger.error("Error, socket is null");
                }

                callback(false, null);   // return that everything went ok
              }
              else {
                callback(true, null);   // return that failed
              }
            }
            else {
              logger.error("Error attempting to insert chat session into db");
              callback(true, null);
            }
          });
        }
        else {
          logger.error("clientID not found in adminJson");
          callback(true, null);
        }

      }
    }
    else {
      var errMsg = null;
      if("message" in profileJson) {
        errMsg = profileJson.message;
      }
      logger.error("Error, unable to get profile details for user, error message: " + errMsg);
      callback(true, null);
      //res.status(404);
      //res.send(errMsg);
    }

  });

}


/*
 * Function to insert a sessionID into the database
 */
function insertDbSessionID(sessionID, clientID, callback) {

  _dbmethods.insertChatSession(sessionID, clientID, function(err, chatsessionID) {
    if(!err) {
      logger.debug("Have inserted into db chatsessionID: " + chatsessionID);
      callback(false, chatsessionID);
    }
    else {
      logger.error("Error attempting to insert sessionID into db for clientID: " + clientID);
      callback(true, null);
    }
  });

}


/*
 * Function to process the incoming message, is assumed that we know who the socket belongs to
 * sessionID - the JSESSIONID
 * socket - socket of the server
 * dataHash - Hash of the session
*/
function processData(sessionID, socket, dataHash) {

  logger.info("In processData");

  if("type" in dataHash) {
    if(dataHash.type == "message") {
      logger.debug('processing a message');
      processMessage(sessionID, socket, dataHash);
    }
    else {
      logger.error("Error, unrecognized datatype: " + dataHash.type);
    }
  }

}


/*
 * Process a message that has been received
*/
function processMessage(sessionID, socket, dataHash) {
  var message = null;
  if("message" in dataHash) {
    message = dataHash.message;
  }

  // This will send to message back to the client
  io.emit('chat message', dataHash.message);
}





