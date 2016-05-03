

var express = require('express');
var app = express();
var Request = require('tedious').Request;
var Connection = require('tedious').Connection;

var connection = null;
var listeningToPort = 8080;
var dataTable = 'IoTdata2';
var topAmountOfLines = 500;
var dataBuffer = [];
var showSqlMessages = false;
var showResultStatus = false;
var showHttpRequest = true;


var config = {
    userName: 'simo',
    password: 'Susanna10',
    server: 'jpc9mrvq4c.database.windows.net',
    // When you connect to Azure SQL Database, you need these next options.
    options: {encrypt: true, database: 'temperatureDB'}
  };
    
  app.get('/', function(request, response){
    if (showHttpRequest) console.log('---Request:azureServer ----------');
    response.sendFile('hostingstart.html' , { root : __dirname});
  });
  
  app.get('/wakeup', function(request, response){
    if (showHttpRequest) console.log('---Request:wakeup ----------');
    response.json({"Wakeup":"Done"});
  });
    
  app.get('/index', function(req, res) {
    /*
      function reads reconds from given time scale (start, end)
    */
    var count = 0;
    var listOfRecords = new Array();
    var temp = new Array();
    var start = req.query.start;
    var end = req.query.end;

    if (showHttpRequest) console.log('---Request:index:"' + start + '"-"' + end + '"');
    var dBrequest = createSelectByDatesMessage(start, end, dataTable);
    while (dataBuffer.length > 0) {
      dataBuffer.pop();
    }
    dataBuffer.push({MaxCount:topAmountOfLines});
    executeDBStatement(dBrequest, res);
  });
  
  app.get('/customer', function(req, res) {
    var name = req.query.name;
    var id = req.query.id;
    var t = '';
    var mode = 0;
    var key = '';
    if (name !== 'undefined') {
      t = 'name="' + name + '"';
      key = name;
      mode = 1;
    }
    else {
      if (id !== 'undefined') {
        t = 'id="' + id + '"';
        key = id;
        mode = 2;
      }
      else {
        t = 'all';
      }
    }
    if (showHttpRequest) console.log('---Request:customer ' + t);
    while (dataBuffer.length > 0) {
      dataBuffer.pop();
    }
    dataBuffer.push({MaxCount:topAmountOfLines});
    getCustomers(mode, key, res);    
  });
  
  app.get('/count', function(req, res) {
    /*
      Function gets count of records.
      If start and end parameters given result is count between them,
      otherwise count of all data in database.
    */
    var start = req.query.start;
    var end = req.query.end;
    if (typeof start !== 'undefined' && start) {
      //console.log('Start' + start);
      if (typeof end !== 'undefined' && end) {
        //console.log('Start:' + start + ' End:' + end);
      } else {
        //console.log('end undefined');
        end = null;
      }
    } else {
      //console.log('start undefined');
      start = null;
    }
    var t = '';
    if (start == null && end == null) {
        
    } else {
      if (end == null) {
        t = ':"' + start + '"';
      } else {
        t = '"' + start + '"-"' + end + '"';
      }
    }
    if (showHttpRequest) console.log('---Request:count' + t);
    getCount(start, end, res);
  });
  
  
  
  function executeDBStatement(dBreqStr,res) {
    /*
    Function executes given database reques and send results back
    as json message.
    */
    var result = [];
    var count = 0;
    var line = [];
    
    if (showSqlMessages) console.log("Sending:" + dBreqStr);
    var request = new Request(dBreqStr,
      function(err) {
        if (err) {
          console.log(err);
        }
      });
            
    request.on('row', function(columns) {
      var c = 0;
      columns.forEach(function(column) {
        //console.log(c++);
        line[c] = column.value;
        if (column.value === null) {
          //console.log('NULL');
        } else {
          //console.log(column.value);
          result.push(column.value);
        }
        c++;
      });
      //console.log(line);
      var newdata = {Id:line[0], Temperature:line[1], Humidity:line[2], Customer:line[3],
                     Location:line[4],Device:line[5],SaveTimeStamp:line[6],Time:line[7],SaveDate:line[8]};
      dataBuffer.push(newdata);
      //console.log('Row number:' + count + '  ' + newdata.Id + ' ' + newdata.Temperature + ' ' + newdata.Humidity);
      count++;
    });

    request.on('doneProc', function(rowCount, more) {
      if (showResultStatus) console.log(count + ' rows returned');
      res.json(dataBuffer);
    });
    connection.execSql(request);
  }
    
 
  function getCount(startkey, endkey, res) {
    /*
    Function executes database count request using given start and end times
    and send result back as json message in format: {Linecount:count} or 
    in error case {Error:errormessage}.
    */    
    var reqStr = 'SELECT COUNT(*) AS lineCount FROM ' + dataTable;
    var count = 0;
    if (startkey != null && endkey != null) {
      reqStr += ' WHERE '  + dataTable + '.Time > ' + startkey + ' and ' +
                             dataTable + '.Time < ' + endkey;
    }
    if (showSqlMessages) console.log("Sending:" + reqStr);
        
    var request = new Request(reqStr, function(err) {
        if (err) {
          console.log(err);
          res.json({"Error":err});
        }
      });
        
    request.on('row', function(columns) {
      columns.forEach(function(column) {
        if (column.value !== null) {
          count = column.value;
        }
      });
    });

    request.on('doneProc', function(rowCount, more) {
      if (showResultStatus) console.log(count + ' rows returned');
      var newdata = {Linecount:count};
      res.json(newdata);

      if (showResultStatus) console.log(newdata);
    });
    connection.execSql(request);
  }

  function createSelectByDatesMessage(startkey, endkey, dTable) {
    var reqStr = '';
    if (startkey != 0 && endkey != 0) {
      reqStr = 'SELECT TOP ' + topAmountOfLines + ' ' + dTable + '.Id, ' +
                                          dTable + '.Temperature, ' +
                                          dTable + '.Humidity, ' + 
                                          dTable + '.Customer, ' +
                                          dTable + '.Location, ' +
                                          dTable + '.Device, ' + 
                                          dTable + '.SaveTimeStamp, ' +
                                          dTable + '.Time, ' + 
                                          dTable + '.SaveDate ' +
		                      'FROM '   + dTable + ' ' +
                              'WHERE '  + dTable + '.Time > ' + startkey + ' and ' +
                                          dTable + '.Time < ' + endkey + ' ' +
                              'ORDER BY SaveTimeStamp DESC';
    } else {
      // get latest lines
      reqStr = 'SELECT TOP ' + 50 + ' ' + dTable + '.Id, ' +
                                          dTable + '.Temperature, ' +
                                          dTable + '.Humidity, ' + 
                                          dTable + '.Customer, ' +
                                          dTable + '.Location, ' +
                                          dTable + '.Device, ' + 
                                          dTable + '.SaveTimeStamp, ' +
                                          dTable + '.Time, ' + 
                                          dTable + '.SaveDate ' +
		                      'FROM '   + dTable + ' ' +
                              'ORDER BY SaveTimeStamp DESC';
    }
    
    return (reqStr);
  }
  
  function getCustomers(mode, key, res) {
    /*
    Function executes given database reques and send results back
    as json message.
    */
    var dTable = 'CustomerInfo';
    var reqStr = 'SELECT ' + ' ' + dTable + '.Id, ' +
                                   dTable + '.CustomerId, ' +
                                   dTable + '.CustomerName, ' + 
                                   dTable + '.CustomerStreetAddress, ' +
                                   dTable + '.DeviceList ' +
		                      'FROM ' + dTable + ' ' +
                              'ORDER BY CustomerName ASC';    
    var result = [];
    var count = 0;
    var line = [];
    
    if (showSqlMessages) console.log("Sending:" + reqStr);
    var request = new Request(reqStr,
      function(err) {
        if (err) {
          console.log(err);
        }
      });
            
    request.on('row', function(columns) {
      var c = 0;
      columns.forEach(function(column) {
        //console.log(c++);
        line[c] = column.value;
        if (column.value === null) {
          //console.log('NULL');
        } else {
          //console.log(column.value);
          result.push(column.value);
        }
        c++;
      });
      //console.log(line);
      var newdata = {Id:line[0], CustomerId:line[1], CustomerName:line[2], CustomerStreetAddress:line[3], DeviceList:line[4]};
                     
      dataBuffer.push(newdata);
      //console.log('Row number:' + count + '  ' + newdata.Id + ' ' + newdata.Temperature + ' ' + newdata.Humidity);
      count++;
    });

    request.on('doneProc', function(rowCount, more) {
      if (showResultStatus) console.log(count + ' rows returned');
      res.json(dataBuffer);
    });
    connection.execSql(request);
  }
  
  
// Connect to database
connection = new Connection(config);
connection.on('connect', function(err) {
  // If no error, then good to proceed.
  console.log("Connected to Azure Database");
  // start listening port
  console.log('Listening on port ' + process.env.PORT);//listeningToPort);
  try {
    app.listen(process.env.PORT);// || listeningToPort);
  }
  catch (err) {
    console.log('Error in server sw:' + err);
  }
});

connection.on('end', function() {
  console.log('Failure in connection to database: ' + config.server);
  
});
  





