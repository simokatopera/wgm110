var Q = require("q"),
    http = require('https'),
	https = require('https'),
	crypto = require('crypto'),
	moment = require('moment');

var namespace,
    hubName,
    keyName,
    key,
	sasTokens = {}; //key=uri, value=SAS token

function getSasToken(uri) {
    var expiration,
        toSign,
		hmac,
		encodedHmac,
		token;

	//Cache tokens to avoid recalculations
    token = sasTokens[uri];

    // remove expired tokens from the cache
	if(token && moment().unix()  < token.expiration) {
		return token.token;
	}

    expiration = moment().add(15, 'days').unix();
    
    toSign = encodeURIComponent(uri) + '\n' + expiration;
    hmac = crypto.createHmac('sha256', key);
    hmac.update(toSign);
	encodedHmac = hmac.digest('base64');

    token = 'SharedAccessSignature sr=' + encodeURIComponent(uri) + '&sig=' + encodeURIComponent(encodedHmac) + 
            '&se=' + expiration + '&skn=' + keyName;

	sasTokens[uri] = {
        token: token,
        expiration: expiration
    };

	return token;
}

//https://msdn.microsoft.com/en-us/library/azure/dn790664.aspx
function getDeviceUri(deviceId) {
  var uri = null;
  if (!deviceId) {
    uri = 'https://' + namespace
          + '.servicebus.windows.net' + '/' + hubName + '/messages';    
  } else {
    uri = 'https://' + namespace
          + '.servicebus.windows.net' + '/' + hubName
          + '/publishers/' + encodeURIComponent(deviceId) + '/messages';    
  }
  return uri;
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
  token = getSasToken(deviceUri);
  //var temp =  deviceId ? '/' + hubName + '/publishers/' + deviceId + '/messages' : '/' + hubName + '/messages';
  //console.log(temp);
    
  requestOptions = {
    hostname: namespace + '.servicebus.windows.net',
    port: 443,
    path: deviceId ? '/' + hubName + '/publishers/' + deviceId + '/messages' : '/' + hubName + '/messages',
    method: 'POST',
    headers: {
            'Authorization': token,
            'Content-Length': payload.length,
            'Content-Type': 'application/atom+xml;type=entry;charset=utf-8'
    }
  }
  console.log('-Request options----------------------------------');
  console.log(requestOptions);
  console.log('-Payload------------------------------------------');
  console.log(payload);
  console.log('--------------------------------------------------');
    
  req = https.request(requestOptions, function (res) {
    res.on('data', function (data) {
      responseData += data;
      console.log('-----------res.on("data")' + data);
    }).on('end', function () {
        console.log('--------res.on("end")  status:' + res.statusCode + ' responseData:' + responseData);
        if (res.statusCode !== 201) {
          deferral.reject(new Error("Invalid server status: " + res.statusCode + "Message: " + responseData));
          return;
        }

        deferral.resolve({ statusCode: res.statusCode, responseData: responseData});
      }).on('error', function (e) {
            console.log('--------res.on("error")' + e);
            deferral.reject(e);
      });
  });
    
  req.on('error', function(e){
        console.log('--------res.on("error")');
    	deferral.reject(e);
  });
  console.log('--------write()');

  req.setSocketKeepAlive(true);
  req.write(payload);
  req.end();
  console.log('--------end()');

  return deferral.promise;
}

exports.init = init;
exports.sendMessage = sendMessage;
exports.sendMessages = sendMessages;



