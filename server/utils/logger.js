require("colors");
var _ = require("lodash");

var config = require("../config/config");

var noop = function () {};

var consoleLog = config.logging ? console.log.bind(console) : noop;

var logger = {
  log: function () {
    var args = _.toArray(arguments).map(function (arg) {
      if (typeof arg === typeof {}) {
        var string = JSON.stringify(arg, 2);
        return "[ LOG ] ".yellow + string.white;
      } else {
        arg.toString();
        return "[ LOG ] ".yellow + arg.white;
      }
    });
    consoleLog.apply(console, args);
  },
  error: function () {
    var args = _.toArray(arguments).map(function (arg) {
      if (typeof arg === typeof {}) {
        var string = JSON.stringify(arg, 2);
        return "[ ERROR ] ".red + string.white;
      } else {
        arg.toString();
        return "[ ERROR ] ".red + arg.white;
      }
    });
    consoleLog.apply(console, args);
  },
};

module.exports = logger;
