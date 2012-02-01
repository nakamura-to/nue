var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var serialEach = nue.serialEach;
var fs = require('fs');

start(serialEach(
  function () {
    this.data = 0;
    this.begin('LICENSE', 'README.md', 'package.json');
  },
  function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) throw this.end(err);
      self.data += data.length;
      self.next(null, self.data);
    });
  },
  function (err, data) {
    if (err) throw err;
    console.log(data);
  }
));