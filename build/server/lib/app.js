// Generated by CoffeeScript 1.7.1
var homeDir, path;

path = require("path");

homeDir = '/usr/local/cozy/apps';

exports.App = (function() {
  function App(app) {
    var match;
    this.app = app;
    this.app.userDir = path.join(homeDir, this.app.name);
    this.app.appDir = this.app.userDir;
    this.app.user = 'cozy-' + this.app.name;
    match = app.repository.url.match(/\/([\w\-_\.]+)\.git$/);
    this.app.dir = path.join(this.app.userDir, match[1]);
    this.app.server = this.app.scripts.start;
    this.app.startScript = path.join(this.app.dir, this.app.server);
    this.app.logFile = "/var/log/cozy/" + app.name + ".log";
    this.app.errFile = "/var/log/cozy/" + app.name + ".err";
  }

  return App;

})();
