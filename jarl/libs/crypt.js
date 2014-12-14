// Nodejs encryption with CTR
var crypto = require('crypto');

// Protocol Functions definition
function Crypt(logger, password) {
  _self = this;
  this.algorithm = 'aes-256-ctr';
  this.password = password

  this.encrypt = function(text){
    var cipher = crypto.createCipher(_self.algorithm, _self.password)
    var crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex');
    return crypted;
  }
 
  this.decrypt = function(text){
    var decipher = crypto.createDecipher(_self.algorithm, _self.password)
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8');
    return dec;
  }
}

// export the class
module.exports = Crypt;




 