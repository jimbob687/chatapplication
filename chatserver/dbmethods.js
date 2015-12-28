
module.exports = {

  insertChatSession: function(jsessionid, clientID, callback) {
    
    pool.getConnection(function(err,connection) {
      if (err) {
        logger.info("Error, unable to get database connection");
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
      }   

      try {

        connection.query('INSERT INTO chatsessions (jsessionid, clientID, chatserverID, expiretime) VALUES (?,?,?,(now() + INTERVAL ? SECOND))', [jsessionid, clientID, _chatServerID, sessionConfig.maxagesecs], function(err,result) {
          connection.release();
          if(!err) {
            var chatsessionID = result.insertId;    // key for the record that has just been inserted
            callback(false, chatsessionID);
          }           
          else {
            logger.error("Error inserting chatsession into db: " + err);
            callback(true, err);
          }
        });

      }
      catch(e) {
        logger.error("Exception attempting to insert chat session " + e);
        connection.release();
        callback(true, err);
      }

      connection.on('error', function(err) {      
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
        return;
      });

    });
  },

  
  /*
   * Function to remove a chat session from the DB, usually when a socket disconnects
   */
  deleteChatSession: function(chatsessionID, callback) {
    
      pool.getConnection(function(err,connection) {
        if (err) {
          logger.info("Error, unable to get database connection");
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
        }   

        connection.query('DELETE FROM chatsessions WHERE chatsessionid = ?', [chatsessionID], function(err,result) {
          connection.release();
          if(!err) {
            callback(false, null);
          }           
          else {
            logger.error("Error deleting chatsession from db: " + err);
            callback(true, err);
            return;
          }
        });

        connection.on('error', function(err) {      
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
          return;
        });

      });
  },


  /* 
   * Query to see if server already has an active record of it's IPAddress and hostname in the DB
   */
  queryChatServerWithHostName: function(serverIP, serverHostName, callback) {

    pool.getConnection(function(err,connection) {
      if (err) {
        logger.error("Error attempting to get db connection");
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
      }   

      connection.query('SELECT chatserverID FROM chatservers WHERE servername = ? AND serverip = ? AND status = ?', [serverHostName, serverIP, 'active'], function(err, rows) {
        logger.debug("Completed query to get chat server details");
        connection.release();
        if(!err) {
          callback(false, rows);
          return;
        }
        else {
          logger.error("Error querying database for chat server information: " + err);
          callback(true, err);
          return;
        }
      });

      connection.on('error', function(err) {      
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res)
        return;
      });

    });
  },


  // Function to insert a chat server record, to register a server as existing so we can then associate client connections with it
  // serverIP - IP Address of the server that we are adding
  // serverHostName - HostName of the server
  insertChatServer: function(serverIP, serverHostName, callback) {

    pool.getConnection(function(err,connection) {

      if (err) {
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
      }   
      logger.info("About to insert record into db for chat server");

      // invalidate any existing associations for the IPAddress to the chat server
      connection.query('UPDATE chatservers SET status = ?, inactive_date = NOW() WHERE serverip = ? AND status = ?', ['inactive', serverIP, 'active'], function(err,result) {

        if(!err) {
          connection.query('INSERT INTO chatservers (servername, serverip, status) VALUES (?,?,?)', [serverHostName, serverIP, 'active'], function(err,result) {
            connection.release();
            if(!err) {
              var chatserverID = result.insertId;    // key for the record that has just been inserted
              callback(false, chatserverID);
              return;
            }           
            else {
              logger.error("Error inserting chat server into db: " + err);
              callback(true, err);
              return;
            }
          });
        }
        else {
          connection.release();
          logger.error("Error, unable to insert record into chatservers: " + err);
          callback(true, err);
        }

        connection.on('error', function(err) {      
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
          return;
        });

      });
    });

  },


  // Function to associate a chat session with a server, should only be used when a new connection is established
  // chatserverID - ID of the server
  // chatsessionID - ID of the chat session
  insertSessionServer: function(chatserverID, chatsessionID, callback) {
    
    pool.getConnection(function(err,connection) {

      if (err) {
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
      }   

      // invalidate any existing associations for the chat session with other servers
      connection.query('UPDATE sessionserver (status, inactive_date) VALUES (?,?) WHERE chatsessionID = ? AND status = ?', ['inactive', NOW(), chatsessionID, 'active'], function(err,result) {

        if(!err) {
          connection.query('INSERT INTO sessionserver (chatserverID, chatsessionID, status) VALUES (?,?,?)', [jsessionid, clientID, 'active'], function(err,result) {
            connection.release();
            if(!err) {
              var sessionserverID = result.insertId;    // key for the record that has just been inserted
              callback(false, sessionserverID);
              return;
            }           
            else {
              logger.error("Error inserting session server into db: " + err);
              callback(true, err);
              return;
            }
          });
        }

        connection.on('error', function(err) {      
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
          return;
        });

      });

    });
  },


  searchConversation: function(clientID, permHash, callback) {

    try {

      // generate a sum of the conversation participants
      var clientidsum = genClientIDkey( clientID,  permHash );

      var inStmt = buildInStatement( Object.keys(permHash).length + 1 );
    
      pool.getConnection(function(err,connection) {

        if (err) {
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
        }   

        // the query parameters that are for the query
        var selectArray = [];
        selectArray.push(clientID);
        for(var clientIDkey in permHash) {
          selectArray.push(clientIDkey);
        }
        selectArray.push(clientidsum);
        selectArray.push("active");

        connection.query('SELECT co.conversationID, co.status, co.created FROM conversation co LEFT OUTER JOIN conversationparticipants cp ON co.conversationID = cp.conversationID AND cp.clientID IN ' + inStmt + ' WHERE co.clientidsum = ? AND co.status = ? GROUP BY co.conversationID', selectArray, function(err, rows) {

          connection.release();
          if(!err) {
            if(rows.length == 0) {
              callback(false, null, 0);
            }
            else if(rows.length > 1) {
              // this is an error, there should only be 1 result, return the first one, will need to write something to clean this up
              callback(false, rows[0], rows.length);
            }
            else if(rows.length == 1) {
              // found the conversation
              callback(false, rows[0], rows.length);
            }

          }
          else {
            logger.error("Error querying database for conversation information: " + err);
            callback(true, err);
          }
        });

      });
      
    }
    catch(e) {
      callback(true, e);
    }

  },


  // Function to create a conversation in the db and add the clientIDs, this is for a direct chat, not a room/hacienda
  // clientID - ID of the client creating the conversation
  // chatconversionID  - ID of the chat conversation that was just created
  insertConversation: function(clientID, permHash, callback) {

    try {

      // generate a sum of the conversation participants
      var clientidsum = genClientIDkey( clientID,  permHash );
    
      pool.getConnection(function(err,connection) {

        if (err) {
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
        }   

        // invalidate any existing associations for the chat session with other servers
        connection.query('INSERT conversation (clientIDcreator, clientidsum, status) VALUES (?,?,?)', [clientID, clientidsum, 'active'], function(err,result) {

          if(!err) {
            var conversationID = result.insertId;    // key of the conversationID that has just been created

            // Add the client into the db
            connection.query('INSERT INTO conversationparticipants (clientID, conversationID, status) VALUES (?,?,?)', 
				[clientID, conversationID, 'active'], function(err,result) {
              if(err) {
                logger.error("Error, unable to insert sessionserver");
                connection.release();
                callback(true, err);
              }
            });


            for(var clientIDkey in permHash) {
              var clientPermHash = permHash[clientIDkey];    // e.g. "26":{"permission":true,"permtype":"commonclinic"}, clientIDkey is 26

              // Now we need to iterate the clients to be added and make them part of the conversation
              connection.query('INSERT INTO conversationparticipants (clientID, conversationID, status) VALUES (?,?,?)', 
						[clientIDkey, conversationID, 'active'], function(err,result) {
                if(err) {
                  logger.error("Error, unable to insert sessionserver");
                  connection.release();
                  callback(true, err);
                }
             
              });

            }
            connection.release();
            callback(false, conversationID);
          }
          else {
            connection.release();
          }

          connection.on('error', function(err) {      
            var res = {"code" : 100, "status" : "Error in connection database"};
            callback(true, res);
            return;
          });

        });

      });

    }
    catch(e) {
      logger.error("Exception attempting to insert conversation into db for clientID: " + clientID + ". " + e);
      callback(true, null);
    }
  },


  // Query the database for a sessionID details
  querySessionID: function(jsessionid, callback) {

    pool.getConnection(function(err,connection) {
      if (err) {
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
      }   

      connection.query('SELECT chatsessionid, jsessionid, clientID, chatserverID, created, expiretime FROM chatsessions WHERE jsessionid = ?', [jsessionid], function(err, rows) {
        connection.release();
        if(!err) {
          var connectionDetails = {};
          callback(false, rows);
          return;
        }
        else {
          logger.error("Error querying database for sessionID information: " + err);
          callback(true, err);
          return;
        }
      });

      connection.on('error', function(err) {      
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res)
        return;
      });

    });
  },
  

  // Query the db for sessions belonging to a client so we can route messages to servers running sockets that the client has
  queryClientSessions: function(clientID, callback) {

    pool.getConnection(function(err,connection) {
      if (err) {
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
      }   

      connection.query('SELECT chatsessionid, jsessionid, clientID, chatserverID, created, expiretime FROM chatsessions WHERE clientID = ?', [clientID], function(err, rows) {
        connection.release();
        if(!err) {
          var connectionDetails = {};
          callback(false, rows);
        }
        else {
          logger.error("Error querying database for client session information: " + err);
          callback(true, err);
        }
      });

      connection.on('error', function(err) {      
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res)
        return;
      });

    });
  },


  // Query the db to get the state of the client, i.e. online, offline, busy
  queryClientState: function(clientID, callback) {

    try {

      pool.getConnection(function(err,connection) {
        if (err) {
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
        }   

        logger.debug("About to query db for clientstate for clientID: " + clientID);
        connection.query('SELECT clientstateid, clientstate, created FROM clientstate WHERE clientID = ?', [clientID], function(err, rows) {
          connection.release();
          if(!err) {
            logger.debug("Rows returned for clientID: " + clientID + "    - " + rows.length);
            var connectionDetails = {};
            callback(false, rows);
          }
          else {
            logger.error("Error querying database for client session information: " + err);
            callback(true, err);
          }
        });

        connection.on('error', function(err) {      
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res)
        });

      });

    }
    catch(e) {
      logger.error("Exception attempting to query db for persistent client state for clientID: " + clientID + ". " + e);
      callback(true, null);
    }
  },


  updateClientState: function(clientID, clientState, callback) {
    /*
     * Update the client state in the db, will delete any existing records and then INSERT a new record, this is for persistent storage
     */

    try {
    
      pool.getConnection(function(err,connection) {

        if (err) {
          var res = {"code" : 100, "status" : "Error in connection database"};
          callback(true, res);
        }   

        connection.query('DELETE FROM clientstate WHERE clientID = ?', [clientID], function(err, deleteResult) {

          if(!err) {

            // invalidate any existing associations for the chat session with other servers
            connection.query('INSERT INTO clientstate (clientID, clientstate, status) VALUES (?,?,?)', [clientID, clientState, 'active'], function(err,result) {

              connection.release();
              if(!err) {
                var clientStateID = result.insertId;    // key of the conversationID that has just been created
                callback(false, clientStateID);
              }
              else {
              }

              connection.on('error', function(err) {      
                var res = {"code" : 100, "status" : "Error in connection database"};
                callback(true, res);
              });

            });

          }
          else {
            logger.error("Error attempting to delete state record for clientID: " + clientID + " from DB. " + err);
            connection.release();
            callback(true, null);
          }

          connection.on('error', function(err) {      
            var res = {"code" : 100, "status" : "Error in connection database"};
            callback(true, res);
          });

        });

      });

    }
    catch(e) {
      logger.error("Error, Exception attempting to update client state: " + e);
      callback(true, null);
    }
  },


  // Query the database for the latest chat message count in a conversation, usually so we can populate the redis counter
  queryChatMessageCount: function(conversationID, callback) {

    pool.getConnection(function(err,connection) {
      if (err) {
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
      }   

      connection.query('SELECT messagecounter FROM conversationmessages WHERE conversationID = ? ORDER BY messagecounter DESC LIMIT 1', [conversationID], function(err, rows) {
        connection.release();
        if(!err) {
          if(rows.length == 0) {
            // we don't have any messages yet so send back 0
            callback(false, 0)
          }
          else if(rows.length > 0) {
            var row = rows[0];    
            if(rows.length > 1) {
              logger.error("Error, recevied a row count of: " + rows.length + " getting message counter for counversationID: " + conversationID);
            }
            if("messagecounter" in row) {
              callback(false, row.messagecounter);
            }
            else {
              logger.error("Error, messagecounterID is not found in results getting message counter for conversionID: " + conversationID);
              callback(true, null);
            }
          }
        }
        else {
          logger.error("Error querying database for message counter for conversationID: " + conversationID + ". "  + err);
          callback(true, err);
          return;
        }
      });

      connection.on('error', function(err) {      
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res)
        return;
      });

    });
  },
  
  // Query the database for a conversation's chat messages
  queryChatMessages: function(dbQuery, dbParamArray, conversationID, callback) {

    pool.getConnection(function(err,connection) {
      if (err) {
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res);
      }   

      connection.query(dbQuery, dbParamArray, function(err, rows) {
        connection.release();
        if(!err) {
          callback(false, rows);
        }
        else {
          logger.error("Error querying database for chat messages for conversationID: " + conversationID + ". "  + err);
          callback(true, err);
          return;
        }
      });

      connection.on('error', function(err) {      
        var res = {"code" : 100, "status" : "Error in connection database"};
        callback(true, res)
        return;
      });

    });
  }


}




/*
 * Function to calculate the total clientIDs to add as a key in the database to index a conversation to make it easy to search in the future
 */
function genClientIDkey( clientID, dataHash ) {

  try {
    logger.debug("In genClientIDkey");

    var clientidSum = parseInt(clientID);

    for(var clientIDkey in dataHash) {
      clientidSum += parseInt(clientIDkey);
    }

    return clientidSum;
  }
  catch(e) {
    logger.error("Exception attempting to calc clientIDsum. " + e);
    return null;
  }

}



/*
 * Function to create an IN statement for a SELECT
 */
function buildInStatement( elementLength ) {

  var inStr = "(";

  try {  
    var firstDone = false;
    for(var i = 0; i < elementLength; i++) {
      if(firstDone) {
        inStr += ",?";
      }
      else {
        inStr += "?";
        firstDone = true;
      }
    }

    inStr += ")";
    return inStr;
  }
  catch(e) {
    logger.error("Exception attempting to create build in statement " + e);
    return null;
  }

}
