

var express = require('express');
var app = express();
var sql = require('./sqlServer');

var listeningToPort = 8080;
var showHttpRequest = true;
var errorMessage = {};

var DatabaseConfig = {
    userName: 'hmon',
    password: 'Heatingmon1',
    server: 'fyn7a28mhq.database.windows.net',
    // When you connect to Azure SQL Database, you need these next options.
    options: {encrypt: true, database: 'HeatingMonDB'}
  };

// ------------------------------------------------------------
//    Api interface functions
// ------------------------------------------------------------
  
  app.get('/', function(request, response){
    if (showHttpRequest) console.log('---Request:azureServer ----------');
    response.sendfile('HeatMonitor.html' , { root : __dirname});
  });
  
  app.get('/wakeup', function(request, response){
    if (showHttpRequest) console.log('---Request:wakeup ----------');
    response.json({"Wakeup":"Done"});
  });

  app.get('/index', function(req, res) {
    /*
      function reads reconds from given time scale (start, end)
    */
    var params;
    params = getQueryParams(req.query, {'kukku':false,'custid':false, 'start':false, 'end':false});
    var errorMsg = checkParameterStatus(params)
    if (errorMsg == null) {
      showDebugMsg('/index', params);
      sql.readTable(1, params, function(data){res.json(data);});
    }
    else {
      res.json(errorMsg);
    }
  });
  
  app.get('/customer', function(req, res) {
    var params;
    params = getQueryParams(req.query, {'name':false,'id':false});
    var errorMsg = checkParameterStatus(params)
    if (errorMsg == null) {
      showDebugMsg('/customer', params);
      sql.getCustomerData(0, params, function(data){res.json(data);});
    }
    else {
      res.json(errorMsg);
    }
  });
  
  app.get('/count', function(req, res) {
    /*
      Function gets count of records.
      If start and end parameters given result is count between them,
      otherwise count of all data in database.
    */
    var params;
    params = getQueryParams(req.query, {'start':false, 'end':false});
    var errorMsg = checkParameterStatus(params)
    if (errorMsg == null) {
      showDebugMsg('/count', params);
      sql.getCount(0, params, function(data){res.json(data);});
    }
    else {
      res.json(errorMsg);
    }
  });
  
  
// ------------------------------------------------------------
//    Private functions
// ------------------------------------------------------------

  function showDebugMsg(id, params){
    if (showHttpRequest) {
      var p = '';
      var keys = Object.keys(params);
      for (var i = 0; i < keys.length;i++) {
        if (i > 0) p += ', ';
        p += keys[i] + '=' + params[keys[i]];
      }
      console.log('--- Request: ' + id + '  parameters: ' + p);
    }
  }
  
  function getQueryParams(inputParams, paramList) {
    var outputParams = {};
    var index;
    // get all requested parameters from input params
    for (index = 0; index < Object.keys(paramList).length; index++){
      var val = inputParams[Object.keys(paramList)[index]];
      if (typeof val === 'undefined') {
        // if requested parameter not given
        var k = Object.keys(paramList)[index];
        if (paramList[k] == true) {
          // if missing parameter is required, give an error
          console.log('ERRROR ERROR ERROR ERROR');
          var msg = 'Required parameter missing: (' + k + ')';
          errorMessage = {'Error':msg};
          outputParams = {};
          break;
        }
      }
      outputParams[Object.keys(paramList)[index]] = val;
    }
    return (outputParams);
  }
  
  function checkParameterStatus(params) {
    var st = true;
    if (isEmpty(params)) {
      // no parameters to use, check if error
      if (errorMessage === null || isEmpty(errorMessage)) {
      } else {
        var buffer = [];  
        buffer.push(errorMessage)
        return buffer;
      }
    }
    return null;
  }
    
  function isEmpty(obj) {
    return Object.keys(obj).length === 0;
  }

// ------------------------------------------------------------
//    M A I N   Program
// ------------------------------------------------------------
  
  var args = process.argv.slice(2);
  var portToUse = process.env.PORT;
  if (typeof args[0] !== 'undefined' && args[0]) {
    portToUse = (portToUse || args[0]);
  }

  sql.createConnection(DatabaseConfig);

  try {
    console.log('Listening on port: ' + portToUse);
    app.listen(portToUse);
  }
  catch (err) {
    console.log('Error in server sw:' + err);
  }

  





