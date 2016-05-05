
var Q = require("q");

var easyConfig = require('easy-config');
var eventHubs = require('./client.js');

// Full Event Hub publisher URI
var config;
//var eventHubsUri;
var sasToken;

var config = easyConfig.loadConfig();

if (!config.EventHubsNamespace) {
    throw new Error("Config file not found, or you forgot to set the namespace in the config.");
}

var idnumber=1;
var prevTemp = 25;
var prevHum = 50;

var eventHubsNamespace = config.EventHubsNamespace,
    eventHubsHubName = config.EventHubsHubName,
    eventHubsKeyName = config.EventHubsKeyName,
    eventHubsKey = config.EventHubsKey,
    sasToken = config.SasToken,
    
    customerId = config.CustomerId,
    deviceId = config.DeviceId,
    deviceList = config.Devices;
    deviceName = config.DeviceNamex;

//console.log('customer id ' + customerId);
testSendContinuous();
//testSendPerformance();
//example1();
//exampleWithSasToken();

function formatDateTime2(){
  var date;
  date = new Date();
  date = date.getUTCFullYear() + '-' +
            ('00' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
            ('00' + date.getUTCDate()).slice(-2) + ' ' +
            ('00' + date.getUTCHours()).slice(-2) + ':' +
            ('00' + date.getUTCMinutes()).slice(-2) + ':' +
            ('00' + date.getUTCSeconds()).slice(-2);   
  return (date);
}

function sendRandomData(silent) {
    var deferral = Q.defer();
    var currtimeStr = new Date;
    //var currtimeStr = formatDateTime2();
    var currentTime = Date.parse(currtimeStr);

    /*
    cust_id smallint
    device_id int
    meas_time datetime2
    save_time datetime2
    triggering_event smallint
    sensor0 real
     ...
    sensor7 real
    */
    var tempCustid = Math.floor(Math.random() * 5);
    //tempCustid = 1;
    var trigger = Math.floor(Math.random() * 5);
    var payload = {
        cust_id: tempCustid, //customerId,
        device_id: deviceId,
        meas_time : currentTime,
        // save_time: not done here
        triggering_event: trigger,
        sensor0: (prevTemp + 3 * (Math.random() - 0.5)),
        sensor1: (prevHum + 2 * (Math.random() - 0.5)),
        sensor2: (prevTemp + 4 * (Math.random() - 0.5)),
    }
    if (tempCustid != 1){
      payload.sensor3 = prevTemp + 5 * (Math.random() - 0.5);
    }
    
    prevHum = payload.sensor1;
    prevTemp = payload.sensor0;
    idnumber++;
    
    //console.log(payload);
    eventHubs.sendMessage({
        message: payload,
        deviceId: deviceName,
    }).then(function () {
        //console.log(payload);
        //if (!silent) console.log('Sent ' + JSON.stringify(payload));
        deferral.resolve();
    }).catch(function (error) {
        if (!silent) console.log('Error sending message: ' + error);
        deferral.reject(error);
    })
        .done();
    
    return deferral.promise;
}

function testSendContinuous() {
    eventHubs.init({
        hubNamespace: eventHubsNamespace,
        hubName: eventHubsHubName,
        keyName: eventHubsKeyName,
        key: eventHubsKey
    });
    sendRandomData();
    setInterval(sendRandomData, 1000.0 * 10);
}
/*
function testSendPerformance() {
    eventHubs.init({
        hubNamespace: eventHubsNamespace,
        hubName: eventHubsHubName,
        keyName: eventHubsKeyName,
        key: eventHubsKey
    });

    //warm-up
    sendRandomData(true);
    sendRandomData(true);
    sendRandomData(true);
    sendRandomData(true);
    sendRandomData(true);
    
    var i,
        start = new Date(),
        end,
        promise,
        promises = [],
        iterations = 1000;
    
    for (i = 0; i < iterations; i++) {
        promise = sendRandomData(true);
        promises.push(promise);
    }
    Q.allSettled(promises).then(function () {
        end = new Date();
        var elapsed = end.getTime() - start.getTime();
        console.log('Test Complete. Took ' + elapsed + 'ms to send ' + iterations + 'messages');
        console.log(elapsed / iterations + 'ms / message');
        console.log(1000 / (elapsed / iterations) + ' messages / second');
    });
}
*/
/*
function example1() {
    eventHubs.init({
        hubNamespace: eventHubsNamespace,
        hubName: eventHubsHubName,
        keyName: eventHubsKeyName,
        key: eventHubsKey
    });

    var deviceMessage = {
        Temperature: 45.2,
        Pressure: 23.7
    }

    eventHubs.sendMessage({
        message: deviceMessage,
        deviceId: 1,
    });
}
*/
/*
function exampleWithSasToken() {
    eventHubs.init({
        hubNamespace: eventHubsNamespace,
        hubName: eventHubsHubName,
        sasToken: sasToken
    });
    
    var deviceMessage = {
        Temperature: 45.2,
        Pressure: 23.7
    }
    
    eventHubs.sendMessage({
        message: deviceMessage,
        deviceId: 1,
    });
}
*/
