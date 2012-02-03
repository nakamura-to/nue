var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var serialEach = nue.serialEach;
var fs = require('fs');

start(serialEach(
  function () {
    this.next('LICENSE', 'README.md', 'package.json');
  },
  function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) throw self.end(err);
      self.next(data.length);
    });
  },
  function (err, results) {
    if (err) throw err;
    console.log(results);
  }
));