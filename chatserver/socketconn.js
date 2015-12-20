
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
          processChatStart(jsessionID, socket, dataHash);
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

  logger.debug("Added to socketClientHash for clientID: " + clientID + " hash: " + JSON.stringify(clientHash));

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
