
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;

var SqlConnection = null;
var dataTable = 'MEASUREMENTS';
var customerTable = 'CUSTOMER_DATA';
var topAmountOfLines = 500;
var dataBuffer = [];
var showSqlMessages = true;
var showResultStatus = false;

function createConnection(config) {
  SqlConnection = new Connection(config);
  SqlConnection.on('connect', function(err) {
    console.log("Connected to Azure Database");
  });

  SqlConnection.on('end', function() {
    console.log('Failure in connection to database: ' + config.server);
  });
}

function readTable(mode, params, callback) {
  var data = {};
  var dBrequest = null;
  clearBuffer();
  if (mode == 1) {
    dataBuffer.push({MaxCount:topAmountOfLines});
    dBrequest = createSelectByDatesMessage(params.custid, params.start, params.end, dataTable);
  }
  if (dBrequest){
    executeDBStatement(dBrequest, callback);
  }
  else {
    dataBuffer.push({Error:'Invalid table read mode:' + mode});
    callback(dataBuffer);
  }
}

function getCount(mode, params, callback) {
  /*
  Function executes database count request using given start and end times
  and send result back as json message in format: {Linecount:count} or 
  in error case {Error:errormessage}.
  */    
  var reqStr = {};
  var count = 0;
  var startDay = null;
  var endDay = null;
  if (typeof params.start !== undefined) startDay = params.start;
  if (typeof params.end !== undefined) endDay = params.end;
    
  reqStr.message = 'SELECT COUNT(*) AS lineCount FROM ' + dataTable;
  if (params.start != null && params.end != null) {
    reqStr.message += ' WHERE '  + dataTable + '.meas_time > ' + startDay + ' and ' +
                                   dataTable + '.meas_time < ' + endDay;
  }
  if (showSqlMessages) console.log("Sending:" + reqStr.message);
        
  var request = new Request(reqStr.message, function(err) {
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
    callback(newdata);

    if (showResultStatus) console.log(newdata);
  });
  if (SqlConnection) SqlConnection.execSql(request);
}



function createSelectByDatesMessage(custid, startkey, endkey, dTable) {
  var reqStr = {};
  if (typeof custid === undefined) custid = '';
  reqStr.tableColumn = ['id','cust_id','device_id','meas_time','save_time','triggering_event',
                         'sensor0','sensor1','sensor2','sensor3','sensor4','sensor5','sensor6','sensor7'];
  if (startkey != 0 && endkey != 0) {
    reqStr.message = 'SELECT TOP ' + topAmountOfLines + ' '
    for (var index = 0; index < reqStr.tableColumn.length; index++) {
      if (index > 0)reqStr.message += ', ';
      reqStr.message += dTable + '.' + reqStr.tableColumn[index];
    }
    reqStr.message += ' FROM '   + dTable + ' ' +
                       'WHERE '  + dTable + '.meas_time > ' + startkey + ' and ' +
                                   dTable + '.meas_time < ' + endkey;
   if (custid != ''){        
                 reqStr.message += ' and ' +
                                   dTable + '.cust_id = ' + custid;
   }
                 reqStr.message += ' ORDER BY save_time DESC';
  } else {
    // get latest lines
    reqStr.message = 'SELECT TOP ' + 50 + ' '
    for (var index = 0; index < reqStr.tableColumn.length; index++) {
      if (index > 0)reqStr.message += ', ';
      reqStr.message += dTable + '.' + reqStr.tableColumn[index];
    }
    reqStr.message += ' FROM '   + dTable + ' ' +
                        'ORDER BY save_time DESC';
  }
    
  return (reqStr);
}

function executeDBStatement(dBreqStr,callback) {
  /*
  Function executes given database reques and send results back
  as json message.
  */
  var result = [];
  var count = 0;
  var line = [];
    
  if (showSqlMessages) console.log("Sending:" + dBreqStr.message);
  var request = new Request(dBreqStr.message,
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
    var newdata = {};
    var value;
    for (var i = 0; i < dBreqStr.tableColumn.length; i++) {
      value = line[i];
      if (dBreqStr.tableColumn[i].indexOf('sensor') >= 0){
        if (isNumeric(line[i])){
          value = Math.round(100.0 * line[i]) / 100;
        }
      }
      newdata[dBreqStr.tableColumn[i]] = value;
    }

    dataBuffer.push(newdata);
    //console.log('Row number:' + count + '  ' + newdata.Id + ' ' + newdata.Temperature + ' ' + newdata.Humidity);
    count++;
  });

  request.on('doneProc', function(rowCount, more) {
    if (showResultStatus) console.log(count + ' rows returned');
    callback(dataBuffer);
  });
  if (SqlConnection) SqlConnection.execSql(request);
}

function getCustomerData(mode, params, callback) { 
  var nmode = 0;
  var key = '';
  if (params.name !== 'undefined') {
    t = 'name="' + params.name + '"';
    key = params.name;
    nmode = 1;
  }
  else {
    if (params.id !== 'undefined') {
      t = 'id="' + params.id + '"';
      key = params.id;
      nmode = 2;
    }
    else {
      t = 'all';
    }
  }
  clearBuffer();
  dataBuffer.push({MaxCount:topAmountOfLines});
  getCustomers(mode, key, callback);    
}
  
function getCustomers(mode, key, callback) {
  /*
  Function executes given database reques and send results back
  as json message.
  */
  var dTable = customerTable;
  var reqStr = {};
  var result = [];
  var count = 0;
  var line = [];
  reqStr.tableColumn = ['cust_id','cust_subscription_plan','cust_name','cust_address',
                        'cust_city','cust_zip_code','cust_tel'];
  reqStr.message = 'SELECT ' + ' ';
  for (var index = 0; index < reqStr.tableColumn.length; index++) {
    if (index > 0)reqStr.message += ', ';
    reqStr.message += dTable + '.' + reqStr.tableColumn[index];
  }
 
 reqStr.message +=
                       ' FROM ' + dTable + ' ' +
                       'ORDER BY cust_name ASC';    
    
  if (showSqlMessages) console.log("Sending:" + reqStr.message);
  var request = new Request(reqStr.message,
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
    var newdata = {};
    for (var i = 0; i < reqStr.tableColumn.length; i++) {
      newdata[reqStr.tableColumn[i]] = line[i];
    }
                     
    dataBuffer.push(newdata);
    //console.log('Row number:' + count + '  ' + newdata.Id + ' ' + newdata.Temperature + ' ' + newdata.Humidity);
    count++;
  });

  request.on('doneProc', function(rowCount, more) {
    if (showResultStatus) console.log(count + ' rows returned');
    callback(dataBuffer);
  });
  if (SqlConnection) SqlConnection.execSql(request);
}
  
function clearBuffer() {
  while (dataBuffer.length > 0) {
    dataBuffer.pop();
  }
}

function isNumeric(val) {
  return Number(parseFloat(val))==val;
}

  
exports.createConnection = createConnection;
exports.readTable = readTable;
exports.getCount = getCount;
exports.getCustomerData = getCustomerData;

