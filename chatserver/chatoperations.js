
/*
* Functions to control chat conversations
*/

module.exports = {


  queryChatInformation: function(conversationID, callback) {

    var permsOK = processAdminPermissions(adminPermHash);
    if(permsOK) {
      // Perms are OK, so return the permHash
      callback(false, adminPermHash);
    }
    else {
      // The perms aren't ok
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


