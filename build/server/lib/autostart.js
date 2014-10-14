// Generated by CoffeeScript 1.8.0
var App, Client, checkStart, config, controller, couchDBClient, couchDBStarted, errors, fs, getManifest, permission, recoverStackApp, start, startStack;

fs = require('fs');

Client = require('request-json-light').JsonClient;

controller = require('./controller');

permission = require('../middlewares/token');

App = require('./app').App;

config = require('./conf').get;

couchDBClient = new Client('http://localhost:5984');


/*
    Check if couchDB is started
        * If couchDB isn't startec check again after 5 secondes
        * Return error after <test> (by default 5) tests
 */

couchDBStarted = function(test, callback) {
  if (test == null) {
    test = 5;
  }
  return couchDBClient.get('/', function(err, res, body) {
    if (err == null) {
      return callback(true);
    } else {
      if (test > 0) {
        return setTimeout(function() {
          return couchDBStarted(test - 1, callback);
        }, 5 * 1000);
      } else {
        return callback(false);
      }
    }
  });
};


/*
    Return manifest of <app> from database application
 */

getManifest = function(app) {
  app.repository = {
    type: "git",
    url: app.git
  };
  app.name = app.name.toLowerCase();
  return app;
};

errors = {};


/*
    Start all applications (other than stack applications)
        * Recover manifest application from document stored in database
        * If it state is 'installed'
            * Start application
            * Check if application is started
            * Update application port in database
        * else
            * Add application in list of installed application
 */

start = function(apps, clientDS, callback) {
  var app, appli, cb;
  if ((apps != null) && apps.length > 0) {
    appli = apps.pop();
    app = getManifest(appli.value);
    if (app.state === "installed") {
      console.log("" + app.name + ": starting ...");
      cb = 0;
      return controller.start(app, function(err, result) {
        cb = cb + 1;
        if ((err != null) && cb === 1) {
          console.log("" + app.name + ": error");
          console.log(err);
          errors[app.name] = new Error("Application didn't started");
          return controller.addDrone(app, function() {
            return start(apps, clientDS, callback);
          });
        } else {
          appli = appli.value;
          appli.port = result.port;
          return clientDS.put('/data/', appli, function(err, res, body) {
            console.log("" + app.name + ": started");
            return start(apps, clientDS, callback);
          });
        }
      });
    } else {
      app = new App(app);
      return controller.addDrone(app.app, function() {
        return start(apps, clientDS, callback);
      });
    }
  } else {
    return callback();
  }
};


/*
    Check if application is started
        * Try to request application
        * If status code is not 200, 403 or 500 return an error
        (proxy return 500)
 */

checkStart = function(port, callback) {
  var client;
  client = new Client("http://localhost:" + port);
  return client.get("", function(err, res) {
    var _ref;
    if (res != null) {
      if ((_ref = res.statusCode) !== 200 && _ref !== 401 && _ref !== 402 && _ref !== 302) {
        console.log("Warning : receives error " + res.statusCode);
      }
      return callback();
    } else {
      return checkStart(port, callback);
    }
  });
};


/*
    Recover stack applications
        * Read stack file
        * Parse file
        * Return error if file stack doesn't exist
            or if isn't in correct json
        * Return stack manifest
 */

recoverStackApp = function(callback) {
  return fs.readFile(config('file_stack'), 'utf8', function(err, data) {
    if ((data != null) || data === "") {
      try {
        data = JSON.parse(data);
        return callback(null, data);
      } catch (_error) {
        console.log("stack isn't installed");
        return callback("stack isn't installed");
      }
    } else {
      console.log("Cannot read stack file");
      return callback("Cannot read stack file");
    }
  });
};


/*
    Start stack application <app> defined in <stackManifest>
        * Check if application is defined in <stackManifest>
        * Start application
        * Check if application is started
 */

startStack = function(stackManifest, app, callback) {
  var err;
  if (stackManifest[app] != null) {
    console.log("" + app + ": starting ...");
    return controller.start(stackManifest[app], function(err, result) {
      var timeout;
      if ((err != null) || !result) {
        console.log(err);
        err = new Error("" + app + " didn't started");
        return callback(err);
      } else {
        console.log("" + app + ": checking ...");
        timeout = setTimeout(function() {
          return callback("[Timeout] " + app + " didn't start");
        }, 30000);
        return checkStart(result.port, function() {
          clearTimeout(timeout);
          console.log("" + app + ": started");
          return setTimeout(function() {
            return callback(null, result.port);
          }, 1000);
        });
      }
    });
  } else {
    err = new Error("" + app + " isn't installed");
    return callback();
  }
};


/*
    Autostart :
        * Stack application are declared in file stack
            /usr/local/cozy/stack.json by default
        *  Other applications are declared in couchDB
 */

module.exports.start = function(callback) {
  console.log("### AUTOSTART ###");
  return couchDBStarted(5, function(started) {
    var err;
    if (started) {
      console.log('couchDB: started');
      return recoverStackApp(function(err, manifest) {
        if (err != null) {
          return callback();
        } else if (manifest['data-system'] == null) {
          console.log("stack isn't installed");
          return callback();
        } else {
          return startStack(manifest, 'data-system', function(err, port) {
            var clientDS, path;
            if (err != null) {
              return callback(err);
            } else {
              clientDS = new Client("http://localhost:" + port);
              clientDS.setBasicAuth('home', permission.get());
              path = '/request/application/all/';
              return clientDS.post(path, {}, function(err, res, body) {
                if (res.statusCode === 404) {
                  return callback();
                } else {
                  return start(body, clientDS, function(errors) {
                    if (errors !== {}) {
                      console.log(errors);
                    }
                    startStack(manifest, 'home', function(err) {
                      if (err != null) {
                        return console.log(err);
                      }
                    });
                    return startStack(manifest, 'proxy', function(err) {
                      if (err != null) {
                        console.log(err);
                      }
                      return callback();
                    });
                  });
                }
              });
            }
          });
        }
      });
    } else {
      err = new Error("couchDB isn't started");
      return callback(err);
    }
  });
};
