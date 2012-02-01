var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var parallelEach = nue.parallelEach;
var fs = require('fs');

start(parallelEach(
  function () {
    this.begin('LICENSE', 'README.md');
  },
  function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) this.end(err);
      self.join(data.length);
    });
  },
  function (err, results) {
    if (err) throw err;
    console.log(results);
  }
));