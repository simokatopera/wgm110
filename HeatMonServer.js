

var express = require('express');
var app = express();
var sql = require('./sqlServer');
//var https = require('https');
var http = require('http');
const fs = require('fs');
var basicAuth = require('basic-auth');

var showHttpRequest = true;
var errorMessage = {};

var DatabaseConfig = {
    userName: 'hmon',
    password: 'Heatingmon1',
    server: 'fyn7a28mhq.database.windows.net',
    // When you connect to Azure SQL Database, you need these next options.
    options: {encrypt: true, database: 'HeatingMonDB'}
  };

var auth = function (req, res, next) {
  function unauthorized(res) {  // yleinen vastaus jos ei onnistu
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };
  var user = basicAuth(req);
  if (!user || !user.name || !user.pass) {  // ei tunnuksia
    return unauthorized(res);
  };
  if (user.name == 'fool' && user.pass == 'bar') {
    return next();   // ohjaa toiminnan eteenpäin
  } else {
    return unauthorized(res);
  };
};
var auth2 = function (req, res, next) {
  function unauthorized(res) {  // yleinen vastaus jos ei onnistu
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };
  var user = basicAuth(req);
  if (!user || !user.name || !user.pass) {  // ei tunnuksia
    return unauthorized(res);
  };
  if (user.name == 'mmm' && user.pass == 'mmm') {
    return next();   // ohjaa toiminnan eteenpäin
  } else {
    return unauthorized(res);
  };
};

  function addMessageToLog( buff){      
    var d = new Date();
    fs.appendFile('log.txt', d + ': ' + buff + '\n\r', function (err) {
      if (err) return console.log(err);
        console.log('log.txt updated');
    });
  }


// ------------------------------------------------------------
//    Api interface functions
// ------------------------------------------------------------
  
  
  app.get("/", function (request, response) {
    if (showHttpRequest) console.log('---Request:azureServer ----------HeatingMon.html');
    response.sendFile('HeatingMon.html' , { root : __dirname});
  });
  
  app.get("/user", function(request, response){
    if (showHttpRequest) console.log('---Request:user ----------');
    var client = request.headers['x-ms-client-principal-name'];
    if (typeof client === 'undefined') {
      client = "Undefined"
    }
    if (client == "") {
      client = "None"
    }
    response.json({"User":client});
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
  
  app.get('/customer', auth2, function(req, res) {
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
  
  app.get('/count', auth, function(req, res) {
    /*
      Function gets count of records.
      If start and end parameters given result is count between them,
      otherwise count of all data in database.
    */
    var params;
    var client = req.headers['x-ms-client-principal-name'];
    addMessageToLog(client);
    
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
  
  app.get('/kukku', function(req, res) {
    console.log('kukkuuu');
    res.sendFile('empty.html' , { root : __dirname});
  });
  app.get('/gecko.jpg', function(req, res) {
    console.log('kukkuuu');
    res.sendFile('gecko.jpg' , { root : __dirname});
  });
  app.get('/images.jpg', function(req, res) {
    console.log('kukkuuu');
    res.sendFile('images.jpg' , { root : __dirname});
  });
  app.get('/bg.jpg', function(req, res) {
    console.log('kukkuuu');
    res.sendFile('bg.jpg' , { root : __dirname});
  });
  app.get('/images.png', function(req, res) {
    console.log('kukkuuu');
    res.sendFile('images.png' , { root : __dirname});
  });

  app.get('/renew', function(req, res) {
    var params;
    params = getQueryParams(req.query, {'id':true});
    var errorMsg = checkParameterStatus(params)
    if (errorMsg == null) {
      showDebugMsg('/renew', params);
      //sql.getCount(0, params, function(data){res.json(data);});
      console.log(req.rawHeaders);
      res.json(req.rawHeaders);
      
      //var fs = require('fs');
      //fs.writeFile("header.txt", JSON.stringify(req), function(err) {
      //  if(err) {
      //    return console.log(err);
      //  }
      //  console.log("The file was saved!");
      //}); 
      //res.json({Key:req.secure});
                  //  'SharedAccessSignature sr=https%3A%2F%2Fheatingmon.servicebu' +
                  //  's.windows.net%2Fheatingmon%2Fpublishers%2F1-100%2Fmessages&sig=ymscqlt35A1%2BOV2' +
                  //  'bi8%2B7o3Ve1cGOkaKc3bXms5zKLbQ%3D&se=1464361807&skn=heatingmon'});
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
  
  //app.configure(function(){
  //  app.use(app.router);
  //});
  
// ------------------------------------------------------------
//    M A I N   Program
// ------------------------------------------------------------

  //const options = {
  //  key: fs.readFileSync('13141453_localhost.key'),
  //  cert: fs.readFileSync('13141453_localhost.cert')
  //};
  //var privateKey = fs.readFileSync('13141453_localhost.key').toString();
  //var certificate = fs.readFileSync('13141453_localhost.cert').toString();  
  
  var args = process.argv.slice(2);
  var portToUse = process.env.PORT;
  if (typeof args[0] !== 'undefined' && args[0]) {
    portToUse = (portToUse || args[0]);
  }

  sql.createConnection(DatabaseConfig);
  
  var d = new Date();
  console.log('Now:' + d + '  ' + d.getTime())
  d = new Date(2016, 0, 1, 2)
  console.log(d + '  ' + d.getTime())
  d = new Date(1970, 0, 1, 2, 0)
  console.log(d + '  ' + d.getTime())
  
  
  console.log('Connecting to port: ' + portToUse);
  //server = https.createServer(options, app).listen(portToUse, HOST);
  server = http.createServer(app).listen(portToUse);
  
  
  /*
  https.createServer(options, (req, res) => {
    res.writeHead(201);
    res.end('hello world\n');
    console.log('Request got');
  }).listen(portToUse);
  */
/*
  try {
    console.log('Listening on port: ' + portToUse);
    app.listen(portToUse);
  }
  catch (err) {
    console.log('Error in server sw:' + err);
  }
*/
  





