

var express = require('express');
var app = express();
var sql = require('./sqlServer');
//var https = require('https');
var http = require('http');
const fs = require('fs');
var basicAuth = require('basic-auth');
//var passport = require('passport-azure-ad');

var showHttpRequest = true;
var errorMessage = {};

var DatabaseConfig = {
    userName: 'hmon',
    password: 'Heatingmon1',
    server: 'fyn7a28mhq.database.windows.net',
    // When you connect to Azure SQL Database, you need these next options.
    options: {encrypt: true, database: 'HeatingMonDB'}
  };

/*
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
*/
///*
var auth = function (req, res, next) {

  function unauthorized(res) {  // yleinen vastaus jos ei onnistu
    //res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    res.statusMessage = 'Basic realm=Authorization Required';
    return res.sendStatus(401);
    //res.statusMessage = "WWW-Authenticate', 'Basic realm=Authorization Required";
    //res.status(401).end();
  };

  var authLevel = 1;
  addMessageToLog('Authentication requested');
  if (sql.authorizationNeeded(req, authLevel) == true) {
    addMessageToLog('Authentication needed');
    var user = basicAuth(req);
    if (!user || !user.name || !user.pass) {  // ei tunnuksia
      addMessageToLog('Login unauthorized:');
      if (user) {
        if (user.name){
          addMessageToLog('User:' + user.name);
        }
        else {
          addMessageToLog('No User name');
        }
        if (user.pass){
          addMessageToLog('Pass:' + user.pass);
        }
        else {
          addMessageToLog('No pass');
        }
      }
      else {
        addMessageToLog('No User at all');
      }
      return unauthorized(res);
    };
    if (user.name == 'kuukku' && user.pass == "vaan"){
    //if (sql.checkUser(req, user.name, user.pass, authLevel)) {
      return next();   // ohjaa toiminnan eteenpäin
    } else {
      res.statusMessage = "Only admin privileges accepted!";
      res.status(401).end();
    }
  }
};
//*/
  function addMessageToLog( buff){      
    var d = new Date();
    fs.appendFile('log.txt', d + ': ' + buff + '\n\r', function (err) {
      if (err) return console.log(err);
        console.log('log.txt updated');
    });
  }

  function getClientPrincipalName(request) {
    var client = request.headers['x-ms-client-principal-name'];
    if (typeof client === 'undefined') {
      client = "Undefined"
    }
    if (client == "") {
      client = "None"
    }
    return client; 
  }
// ------------------------------------------------------------
//    Api interface functions
// ------------------------------------------------------------
 
 
  app.get("/", function (request, response) {
    if (showHttpRequest) console.log('---Request:azureServer ----------HeatingMon.html');
    response.sendFile('HeatingMon.html' , { root : __dirname});
  });
  
  
  //app.get('/login', passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }), function(req, res) {
  app.get('/login', function(req, res) {
    if (showHttpRequest) console.log('---Request:Login ----------');
    //addMessageToLog('Request:Login');
    //log.info('Login was called in the Sample');
    res.redirect('/');
  });
  
  
  app.get('/logout', function(req, res){
    /*
    if (showHttpRequest) console.log('---Request:Logout ----------');
    // We need to go to website https://heatingmon.azurewebsites.net/.auth/logout
    // to get logged out !
    //addMessageToLog('Request:Logout');
    var referer = req.headers['referer'];
    if (typeof referer !== 'undefined') {
      //addMessageToLog('Referer:' + referer);
      console.log("Referer: " + referer);
      //if (referer.indexOf("localhost") < 0) {
        //addMessageToLog('Trying to log out:');
        //addMessageToLog('logout');
        req.logout();
        //res.redirect('/');
        //addMessageToLog('redirect');
        //res.redirect('https://heatingmon.azurewebsites.net/.auth/logout');
        //addMessageToLog('resp');
        //res.json({"Logout":"Done"});
        return;
      //}
    }
    */
    res.json({"Logout":"Not done"});
  });
  
  app.get("/user", function(request, response){
    if (showHttpRequest) console.log('---Request:user ----------');
    var client = getClientPrincipalName(request);
    //console.log(request.rawHeaders);
    //console.log('------------------------')
    //console.log(request.headers);
    //console.log('------------------------')
    //addMessageToLog('Authorization:' + request.headers.authorization);
    //addMessageToLog(JSON.stringify(request.headers));
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
  
  app.get('/userInfo', function(req, res) {
    // read admin data
    var buffer = [];
    sql.checkUser2(req, 99, function(data){
      if (data && data.length > 0){
         buffer.push({"Admin info":data[0]});
      }
      sql.getUserInfo(req, function(data){
         console.log(data);
        if (data && data.length > 0){
          buffer.push({"Customer info":data[0]});
        }
        res.json(buffer);
      });
    });
  });
  
  app.get('/customer', function(req, res) {
    sql.checkUser2(req, 1, function(data){
      //console.log(data);
      
      if (data && data.length > 0){ 
        //console.log('User authorized-----------');
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
      } else {
        var buffer = [];
        buffer.push({'Error':'No privileges'});
        res.json(buffer);
      }
    });
  });
  
  app.get('/count', function(req, res) {
    /*
      Function gets count of records.
      If start and end parameters given result is count between them,
      otherwise count of all data in database.
    */
    var params;
    //var client = getClientPrincipalName(req);
    //addMessageToLog(client);
    
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
    console.log('kukku');
    res.sendFile('empty.html' , { root : __dirname});
  });
  app.get('/gecko.jpg', function(req, res) {
    console.log('gecko.jpg');
    res.sendFile('gecko.jpg' , { root : __dirname});
  });
  app.get('/images.jpg', function(req, res) {
    console.log('images.jpg');
    res.sendFile('images.jpg' , { root : __dirname});
  });
  app.get('/bg.jpg', function(req, res) {
    console.log('bg.jpg');
    res.sendFile('bg.jpg' , { root : __dirname});
  });
  app.get('/images.png', function(req, res) {
    console.log('images.png');
    res.sendFile('images.png' , { root : __dirname});
  });

  app.get('/renew', function(req, res) {
    var params;
    params = getQueryParams(req.query, {'id':true});
    var errorMsg = checkParameterStatus(params)
    if (errorMsg == null) {
      showDebugMsg('/renew', params);
      //sql.getCount(0, params, function(data){res.json(data);});
      //console.log(req.rawHeaders);
      //res.json(req.rawHeaders);
      
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
  





