var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var parallel = nue.parallel;
var fs = require('fs');

start(parallel(
  function () {
    this.fork('LICENSE', 'README.md');
  },
  [
    function (name) {
      var self = this;
      fs.readFile(name, function (err, data) {
        if (err) this.err(err);
        self.join(data.length);
      });
    },
    function (path) {
      var self = this;
      fs.stat(path, function (err, stats) {
        if (err) this.err(err);
        self.join(stats.isFile());
      });
    }
  ],
  function (err, results) {
    if (err) throw err;
    console.log(results);
  }
));