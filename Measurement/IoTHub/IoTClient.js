var Q = require("q"),
    http = require('https'),
	https = require('https'),
	crypto = require('crypto'),
	moment = require('moment');

var apiVersion = '2016-02-03';

var namespace,
    hubName,
    keyName,
    key,
	sasTokens = {}; //key=uri, value=SAS token

var generateSasToken = function(resourceUri, signingKey, policyName, expiresInMins) {
    resourceUri = encodeURIComponent(resourceUri.toLowerCase()).toLowerCase();

    // Set expiration in seconds
    var expires = (Date.now() / 1000) + expiresInMins * 60;
    expires = Math.ceil(expires);
    var toSign = resourceUri + '\n' + expires;

    // using crypto
    var decodedPassword = new Buffer(signingKey, 'base64').toString('binary');
    const hmac = crypto.createHmac('sha256', decodedPassword);
    hmac.update(toSign);
    var base64signature = hmac.digest('base64');
    var base64UriEncoded = encodeURIComponent(base64signature);

    // construct autorization string
    var token = "SharedAccessSignature sr=" + resourceUri + "&sig="
    + base64UriEncoded + "&se=" + expires;
    if (policyName) token += "&skn="+policyName;
    // console.log("signature:" + token);
    return token;
};

//https://msdn.microsoft.com/en-us/library/azure/dn790664.aspx
function getDeviceUri(deviceId) {
  var uri = null;
  uri = getHostName() + getDevice(deviceId);
  return uri;
}
function getHostName() {
  return namespace + '.azure-devices.net';
}
function getDevice(deviceId) {
  return '/devices/' + deviceId;
}
function getDataPath(deviceId) {
  return getDevice(deviceId) + '/messages/events?api-version=' + apiVersion;
}
//hubNamespace, hubName, keyName, key
function init(options) {
  namespace = options.hubNamespace;
  hubName = options.hubName;
  keyName = options.keyName;
  key = options.key;

  //Allow the connection pool to grow larger. This improves performance
  //by a factor of 10x in my testing
  http.globalAgent.maxSockets = 50;
}

function sendMessage(messageObject) {
	var message = messageObject.message,
		deviceId = messageObject.deviceId,
	    payload;
    
    if (typeof message === 'string') {
        payload = message;
    } else {
        //This allows us to send in a POJSO
        payload = JSON.stringify(message);
    }
//console.log('Device : ' + deviceId + ' xxxxxxxxxxxxxxxxxxxxxxxxxx');
    return send(payload, deviceId);
}

function sendMessages(messageObject) {
    var messages = messageObject.messages,
		deviceId = messageObject.deviceId,
        payload;
    if (messages.length === 0)
        throw new Error("Given argument contains no messages!");
    
    payload = JSON.stringify(messages);

    return send(payload, deviceId);
}

function send(payload, deviceId) {
  var deferral,
      requestOptions,
      deviceUri,
      token,
      req,
      responseData = '';

  deferral = Q.defer();
  deviceUri = getDeviceUri(deviceId);
  
  token = generateSasToken(deviceUri, key, null, 60);

  requestOptions = {
    hostname: getHostName(),
    port: 443,
    path: getDataPath(deviceId),
    method: 'POST',
    headers: {
            'Authorization': token,
            'Content-Length': payload.length,
            'Content-Type': 'application/atom+xml;type=entry;charset=utf-8'
//            "Content-Type": "application/json"
    }
  }
  console.log('\n-Request options----------------------------------');
  console.log(requestOptions);
  console.log('\n-Payload------------------------------------------');
  console.log(payload);
  console.log('--------------------------------------------------');
    
  req = https.request(requestOptions, function (res) {
    res.on('data', function (data) {
      responseData += data;
      //console.log('-----------res.on("data")' + data);
    }).on('end', function () {
        if (res.statusCode !== 204) {
          console.log('--------res.on("end")  status:' + res.statusCode + ' responseData:' + responseData);
          deferral.reject(new Error("Invalid server status: " + res.statusCode + "Message: " + responseData));
          return;
        } else {
          console.log('Send succesfull!\n=================================================\n\n\n');
        }

        deferral.resolve({ statusCode: res.statusCode, responseData: responseData});
      }).on('error', function (e) {
            console.log('--------res.on("error")' + e);
            deferral.reject(e);
      });
  });
    
  req.on('error', function(e){
        //console.log('--------res.on("error")');
    	deferral.reject(e);
  });
  //console.log('--------write()');

  req.setSocketKeepAlive(true);
  req.write(payload);
  req.end();
  //console.log('--------end()');

  return deferral.promise;
}

exports.init = init;
exports.sendMessage = sendMessage;
exports.sendMessages = sendMessages;











