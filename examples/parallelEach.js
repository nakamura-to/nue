var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var parallel = nue.parallelEach;
var fs = require('fs');

start(parallel(
  function () {
    this.each('LICENSE', 'README.md');
  },
  function (name, err, result) {
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