
/*
 * This module is for processing chat messages that have been received
 */

module.exports = {




}


/*
 * Retrieve chat messages for a conversation
 * conversationID - the conversation that we want to retrieve the messages for
 * startMessageCounter - Counter of the newest message that we want, if null will start with the latest message
 * endMessageCounter - Counter of the end message, of null if we just want the limit
 * numberMsgs - Number of messages that we want to retrieve (limit), default is set in config
 */
function retrieveChatMessages(conversationID, startMessageCounter, endMessageCounter, numberMsgs, callback) {

  try {
    if(numberMsgs == null) {
      // need to set to the default
      numberMsgs = _messageLimit;
    }

    var dbQuery = null;
    var dbParamArray = [];     // This is the array that will be used for the query
    dbParamArray.push(conversationID);
    // let's create the query that we will use based on the 
    if(startMessageCounter == null) {
      dbQuery = "SELECT cm.chatmessageID, cm.conversationID, cm.messagecounter, cm.created, cm.status FROM chatmessages cm WHERE cm.conversationID = ? ORDER BY cm.messagecounter DESC LIMIT ?";
      dbParamArray.push(numberMsgs);
    }
    else if(startMessageCounter != null && endMessageCounter == null) {
      dbQuery = "SELECT cm.chatmessageID, cm.conversationID, cm.messagecounter, cm.created, cm.status FROM chatmessages cm WHERE cm.conversationID = ? AND cm.messagecounter <= ? ORDER BY cm.messagecounter DESC LIMIT ?";
      dbParamArray.push(startMessageCounter);
      dbParamArray.push(numberMsgs);
    }
    else if(startMessageCounter != null && endMessageCounter != null) {
      dbQuery = "SELECT cm.chatmessageID, cm.conversationID, cm.messagecounter, cm.created, cm.status FROM chatmessages cm WHERE cm.conversationID = ? AND cm.messagecounter <= ? AND cm.messagecounter >= ? ORDER BY cm.messagecounter";
      dbParamArray.push(startMessageCounter);
      dbParamArray.push(endMessageCounter);
    }
    else {
      logger.error("Unrecognized combination to form message query, conversationID: " + conversationID + " startMessageCounter: " + startMessageCounter + " endMessageCounter: " + endMessageCounter + " numberMsgs: " + numberMsgs);
    }

    if(dbQuery != null) {
      _dbmethods.queryChatMessages(dbQuery, dbParamArray, conversationID, function(err, rows) {
        if(!err) {
          // we need to process the messages
        }
        else {
          logger.error("Error attempting to query messages for conversationID: " + conversationID);
          callback(true, null);
        }
      });
    }

  }
  catch(e) {

  }

});


/*
 * Function to increment the messge counter for a conversation in redis
 */
function incrementMsgCount(clientID, conversationID, callback) {

  try {

    var returnHash = {};

    var msgKey = _chatMsgCountKey + ":" + conversationID;   // key for the conversation that we are tracking

    _redisclient.get(msgKey, function(err, reply) {
      // get counter
      if(!err) {
        if(reply != null) {
          // now increment the counter
          _redisclient.incr(msgKey, function(err, reply) {
            if(!err) {
              logger.debug("Increment reply: " + reply);
            }
            else {
              logger.error("Error attempting to increment counter for conversationID: " + conversationID + " in redis. " + err);
            }
          }); 
        }
        else {
          // counter isn't in redis, need to add it by first querying the db
          _dbmethods.queryChatMessageCount(conversationID, function(err, messageCounter) {
             if(!err) {
               // add the counter to redis
               _redisclient.set(msgKey, messageCounter, function(err, reply) {
                 if(!err) {
                   // now increment the counter
                   _redisclient.incr(msgKey, function(err, reply) {
                     if(!err) {
                       logger.debug("Increment reply: " + reply);
                     }
                     else {
                       logger.error("Error attempting to increment counter for conversationID: " + conversationID + " in redis. " + err);
                     }
                   }); 
                 }
                 else {
                   logger.error("Error attempting to add counter to conversationID: " + conversationID + " into redis. " + err);
                   callback(true, null);
                 }
               });
             }
             else {
               logger.error("Error attempting to query message counter from DB for conversationID: " + conversationID);
               callback(true, null);
             }
          });
        }
      }
      else {
        logger.error("Error attempting to get the message counter for conversationID: " + conversationID + " from redis");
        callback(true, null);
      }
    });

  }
  catch(e) {
    logger.error("Exception attempting to increment message counter for conversationID: " + conversationID + ". " + e);
    callback(true, null);
  }

}
