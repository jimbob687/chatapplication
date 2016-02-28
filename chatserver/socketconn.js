
/*
 * This module is designed to handle incoming socket requests
 *
 * A socket should have the following properties
 * clientid - ID of the client
 * jsessionid - cookie related to the socket
 * chatsessionid - key from the chatsession table in the db
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
          checkJsessionID(socket, jsessionID, function(err, returnjSession) {
            // not sure what needs to be done with this callback
          });

        }
        else {
          logger.debug("Socket doesn't have a clientid so need to get from the db");
          //searchSessionID(jsessionID, socket, dataHash, processData);
          adminProfile(sessionID, socket, function(err, returndata) {
            if(!err) {
              processData(sessionID, socket, dataHash);
              if("allchatconv" in returndata) {
                // return the data to the client
                io.emit("allchatconv", returndata.allchatconv);
              }
            }
            else {
              // This is an error, need to return some sort of error
            }
          });
        }

      });


      socket.on('clientlookup', function(dataHash, jsessionID) {
        if("clientid" in socket) {
          logger.info("Have just got an autocomplete request: " + JSON.stringify(dataHash));
          checkJsessionID(socket, jsessionID, function(err, returnjSession) {
            // not sure what needs to be done with this callback
          });
          _commonchat.clientNameSearch(jsessionID, dataHash, function(err, completeHash) {
            if(!err) {
              io.emit('clientautocomplete', completeHash);
            }
            else {
              // Need to add an error message to this to send back to client
            }
          });
        }
        else {
          adminProfile(jsessionID, socket, function(err, returndata) {
            if(!err) {
              _commonchat.clientNameSearch(jsessionID, dataHash, function(err, completeHash) {
                if(!err) {
                  io.emit('clientautocomplete', completeHash);
                }
                else {
                  // Need to add an error message to this to send back to client
                }
              });
            }
            else {

            }

          });
        }
      });


      socket.on('retrieveallconv', function(dataHash, jsessionID) {
        // Retrieve all conversations belonging to a client
        if("clientid" in socket) {
          var clientID = socket.clientid;
          logger.info("Have just got a request to query all conversations belonging to a client");
          checkJsessionID(socket, jsessionID, function(err, returnjSession) {
            // not sure what needs to be done with this callback
          });
          retrieveAllConversations(clientID, socket, jsessionID, function(err, convHash) {
            if(!err) {
              // send back all the conversations to the client
              io.emit("allchatconv", convHash);
            }
            else {
              logger.error("Error attempting to retrieve conversations for clientID: " + clientID);
            }
          });
        }
        else {
          adminProfile(jsessionID, socket, function(err, returndata) {
            if(!err) {
            }
            else {
              // we have an error so return an error
            }
          });
        }
      });


      socket.on('chatcreate', function(dataHash, jsessionID) {
        logger.info("Have just got a chat create request: " + JSON.stringify(dataHash));
        if(socket == null) {
          logger.error("Error, socket is null in chatcreate");
        }
        checkJsessionID(socket, jsessionID, function(err, returnjSession) {
          // not sure what needs to be done with this callback
        });
        if("clientid" in socket) {
          //clientNameSearch(jsessionID, socket, dataHash);
          _startchat.processChatStart(socket.clientid, jsessionID, socket, dataHash, function(err, returnHash) {
	    if(!err) {
              // send back that we have successfully created the chat
              io.emit('chatcreated', returnHash);
            }
            else {
              // failed to create the chat
              io.emit('chatcreatefail', "Unable to create chat");
            }
          });
        }
        else {
          adminProfile(jsessionID, socket, function(err, returndata) {
            if(!err) {
              logger.info("Don't have error, so moving on");
              // create a chatsessionID for the chat room
              //processData(jsessionID, socket, dataHash);   // This is not required

              _startchat.processChatStart(socket.clientid, jsessionID, socket, dataHash, function(err, returnHash) {
                if(!err) {
                  // send back that we have successfully created the chat
                  io.emit('chatcreated', returnHash);
                }
                else {
                  // failed to create the chat
                  io.emit('chatcreatefail', "Unable to create chat");
                }
              });

            }
            else {
              // need to return an error
            }
          });
        }
      });


      socket.on('keepalive', function(jsessionID, clientStatus, clientType) {
        logger.info("Client keepalive request");
        // The client should send a keepalive to the central app to say that they are online, used to show a user status
        var clientID = null;
        if("clientid" in socket) {
          clientID = socket.clientid;
        }
        logger.debug("Keepalive received for clientid: " + clientID + " and clientStatus: " + clientStatus);
        if(clientID != null) {
          _redismethods.setKeepalive(clientID, clientType, clientStatus, function(err, returnData) {
            // insert record into db, not sure if we need to do a callback here
          });
        }
        else {
          if(jsessionID != null) {
            adminProfile(jsessionID, socket, function(err, returndata) {
              if(!err) {
                _redismethods.setKeepalive(clientID, clientType, clientStatus, function(err, returnData) {
                  // insert record into db, not sure if we need to do a callback here
                });

                if("allchatconv" in returndata) {
                  // return the data to the client
                  logger.info("Returning allchatconv data to client")
                  io.emit("allchatconv", returndata.allchatconv);
                }
                else {
                  logger.error("Error, no allchatconv in return data for client");
                }
              }
              else {
                logger.error("Error attempting to retrieve adminProfile");
              }
            });
          }
          else {
            logger.info("jsessionID is null for client keepalive request");
          }
        }
      });


      socket.on('disconnect', function(){
        var remClientID = null;
        var remChatSessionID = null;
        var remJsessionID = null;
        logger.debug('user disconnected');
        if("clientid" in socket) {
          remClientID = socket.clientid;
          socket.clientid = null;
        }
        if("chatsessionid" in socket) {
          remChatSessionID = socket.chatsessionid;
          // remove the record from the db
          _dbmethods.deleteChatSession(socket.chatsessionid, function(err, returnData) {
            if(err) {
              logger.error("Error attempting to remove chatsessionID: " + socket.chatsessionid + " from DB on disconnect");
            }
            socket.chatsessionid = null;
          });
        }
        if("jsessionid" in socket) {
          remJsessionID = socket.jsessionid;
          socket.jessionid = null
        }
        if(remClientID != null && remJsessionID != null) {
          // let's remove the session from the hash
        }
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
function checkJsessionID(socket, jsessionID, callback) {
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

    var returnData = {};

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

          /* This is here as a temporary measure until I can figure out where it is meant to go */
          retrieveAllConversations(clientID, socket, sessionID, function(err, convHash) {
            if(!err) {
              logger.info("Returning convHash: " + JSON.stringify(convHash) );
              io.emit("allchatconv", convHash);
              logger.info("Have finished retrieveAllConversations");
              returnData["allchatconv"] = convHash;
            }
          });

          // insert the session into the database
          insertDbSessionID(sessionID, clientID, function(err, chatsessionID) {
            if(!err) {
              logger.debug("Need to update hash for chatsessionID: " + chatsessionID + " and clientID: " + clientID);

              if(clientID !== null) {
                // add the sessionID to the hash
                socketSessionHash[sessionID] = clientID;

                if(socket != null) {
                  socket.clientid = clientID;   // Set the clientID on the socket
                  socket.chatsessionid = chatsessionID;
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

                callback(false, returnData);   // return that everything went ok
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



/*
 * Function to remove a socket from the socketClientHash
 * remClientID - ID of the client that we are removing the socket for
 * remJsessionID - jsessionID of the socket we are removing
 */
function removeSocketFromHash(remClientID, remJsessionID) {
   // socketClientHash
  try {

    if(remClientID in socketClientHash) {
      var thisClientHash = socketClientHash[remClientID];
      if(remJsessionID in thisClientHash) {
        thisClientHash[remJsessionID] = null;
        socketClientHash[remClientID] = thisClientHash;
      }
    }

  }
  catch(e) {
    logger.error("Exception attempting to remove socket from socketClientHash for clientID: " + remClientID);
  }

}


/*
 * Function to retrieve a list of chats for a client and the profiles of the clients
 * clientID - ID of the client we want the chats for
 * socket - Socket that we want to send the conversations back to
 */
function retrieveAllConversations(clientID, socket, sessionID, callback) {

  logger.info("------------In retrieveAllConversations--------------");

  try {
    _dbmethods.searchAllClientConversations(clientID, function(err, convRows) {
      if(!err) {
        var returnHash = {};
        var convArray = []
        var clientIDArray = [];     // Array of client profiles that we need
        if(convRows != null) {
          var convRowLen = convRows.length;
          for (var i = 0; i < convRowLen; i++) {
            var thisRow = convRows[i];
            convArray.push(thisRow); // add the JSON to the array
            if("clientIDs" in thisRow) {
              // now we need to get each of the client profiles
              clientIDVals = thisRow["clientIDs"];
              // Get an array of clients
              var clientIDar = clientIDVals.split(",");
              for(var j = 0; j < clientIDar.length; j++) {
                if (clientIDArray.indexOf(clientIDar[j]) == -1) {
                  // is not in the array so add it
                  clientIDArray.push(clientIDar[j]);
                }
              }


            }
            logger.info("conv: " + JSON.stringify(thisRow));
          }
          returnHash["conv"] = convArray;
        }

        // get all the profiles for the clients
        logger.info("About to grab profiles for clientIDs: " + JSON.stringify(clientIDArray));
        _commonchat.grabClientProfiles(sessionID, clientIDArray, function(err, clientProfilesHash) {
          if(!err) {
            logger.info("clientProfilesHash: " + JSON.stringify(clientProfilesHash));
            returnHash["clientprofiles"] = clientProfilesHash;
            _commonchat.getClientStatus(clientIDArray, function(err, clientStatusHash) {
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
        logger.error("Error attempting to list all chat conversations for clientID: " + clientID);
        callback(true, null);
      }
    });
  }
  catch(e) {
    callback(true, e);
  }

}


// queryClientProfile(targetClientID, sessionID, callback)
