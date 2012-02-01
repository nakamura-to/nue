var nue = require('../lib/nue');
var start = nue.start;
var serial = nue.serial;
var parallel = nue.serialEach;
var fs = require('fs');

start(parallel(
  function () {
    this.each('LICENSE', 'README.md', 'package.json');
  },
  function (name, acc) {
    var self = this;
    acc = acc || {size: 0};
    fs.readFile(name, function (err, data) {
      if (err) throw err;
      acc.size += data.length;
      self.next(acc);
    });
  },
  function (result) {
    console.log(result.size);
  }
));