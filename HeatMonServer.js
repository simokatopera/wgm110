

var express = require('express');
var app = express();
var Request = require('tedious').Request;
var Connection = require('tedious').Connection;

var connection = null;
var listeningToPort = 8080;
var dataTable = 'MEASUREMENTS';
var customerTable = 'CUSTOMER_DATA';
var topAmountOfLines = 500;
var dataBuffer = [];
var showSqlMessages = true;
var showResultStatus = false;
var showHttpRequest = true;


var config = {
    userName: 'hmon',
    password: 'Heatingmon1',
    server: 'fyn7a28mhq.database.windows.net',
    // When you connect to Azure SQL Database, you need these next options.
    options: {encrypt: true, database: 'HeatingMonDB'}
  };
    
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
    var count = 0;
    var listOfRecords = new Array();
    var temp = new Array();
    var start = req.query.start;
    var end = req.query.end;
    var custid = req.query.custid;
    if (custid === 'undefined') custid = '';

    if (showHttpRequest) console.log('---Request:index:"' + custid + '"/"'  + start + '"-"' + end + '"');
    var dBrequest = createSelectByDatesMessage(custid, start, end, dataTable);
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
      var newdata = {id:line[0], cust_id:line[1], device_id:line[2], meas_time:line[3],
                     save_time:line[4],triggering_event:line[5],
                     sensor0:line[6],sensor1:line[7],sensor2:line[8],sensor3:line[9]};
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
      reqStr += ' WHERE '  + dataTable + '.meas_time > ' + startkey + ' and ' +
                             dataTable + '.meas_time < ' + endkey;
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

  function createSelectByDatesMessage(custid, startkey, endkey, dTable) {
    var reqStr = '';
    if (startkey != 0 && endkey != 0) {
      reqStr = 'SELECT TOP ' + topAmountOfLines + 
                                    ' ' + dTable + '.id, ' +
                                          dTable + '.cust_id, ' +
                                          dTable + '.device_id, ' +
                                          dTable + '.meas_time, ' + 
                                          dTable + '.save_time, ' +
                                          dTable + '.triggering_event, ' +
                                          dTable + '.sensor0, ' + 
                                          dTable + '.sensor1, ' +
                                          dTable + '.sensor2, ' + 
                                          dTable + '.sensor3 ' +
		                      'FROM '   + dTable + ' ' +
                              'WHERE '  + dTable + '.meas_time > ' + startkey + ' and ' +
                                          dTable + '.meas_time < ' + endkey;
                if (custid != ''){        
                                          reqStr += ' and ' +
                                          dTable + '.cust_id = ' + custid;
                }
                               reqStr += ' ORDER BY save_time DESC';
    } else {
      // get latest lines
      reqStr = 'SELECT TOP ' + 50 + ' ' + dTable + '.id, ' +
                                          dTable + '.cust_id, ' +
                                          dTable + '.device_id, ' +
                                          dTable + '.meas_time, ' + 
                                          dTable + '.save_time, ' +
                                          dTable + '.triggering_event, ' +
                                          dTable + '.sensor0, ' + 
                                          dTable + '.sensor1, ' +
                                          dTable + '.sensor2, ' + 
                                          dTable + '.sensor3 ' +
		                      'FROM '   + dTable + ' ' +
                              'ORDER BY save_time DESC';
    }
    
    return (reqStr);
  }
  
  function getCustomers(mode, key, res) {
    /*
    Function executes given database reques and send results back
    as json message.
    */
    var dTable = customerTable;
    var reqStr = 'SELECT ' + ' ' + dTable + '.cust_id, ' +
                                   dTable + '.cust_subscription_plan, ' +
                                   dTable + '.cust_name, ' + 
                                   dTable + '.cust_address, ' +
                                   dTable + '.cust_city, ' +
                                   dTable + '.cust_zip_code, ' +
                                   dTable + '.cust_tel ' +
		                      'FROM ' + dTable + ' ' +
                              'ORDER BY cust_name ASC';    
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
      var newdata = {cust_id:line[0], cust_subscription_plan:line[1], cust_name:line[2], 
                     cust_address:line[3], cust_city:line[4], cust_zip_code:line[5], cust_tel:line[6]};
                     
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
  
var args = process.argv.slice(2);
var portToUse = process.env.PORT;
if (typeof args[0] !== 'undefined' && args[0]) {
  portToUse = (portToUse || args[0]);
}

  
// Connect to database
connection = new Connection(config);
connection.on('connect', function(err) {
  // If no error, then good to proceed.
  console.log("Connected to Azure Database");
  // start listening port
  //console.log('Listening on process.env.PORT: ' + process.env.PORT);
  //console.log('Listening on port ' + listeningToPort);
  console.log('Listening on port: ' + portToUse);
  try {
    //app.listen(process.env.PORT);
    //app.listen(listeningToPort);
    app.listen(portToUse);
  }
  catch (err) {
    console.log('Error in server sw:' + err);
  }
});

connection.on('end', function() {
  console.log('Failure in connection to database: ' + config.server);
  
});
  





