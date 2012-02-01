var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var parallel = nue.serialEach;
var fs = require('fs');

start(parallel(
  function () {
    this.data = 0;
    this.each('LICENSE', 'README.md', 'package.json');
  },
  function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) throw err;
      self.data += data.length;
      self.next(self.data);
    });
  },
  function (result) {
    console.log(result);
  }
));