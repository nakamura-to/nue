var nue = require('../lib/nue');
var flow = nue.flow;
var parallelEach = nue.parallelEach;
var fs = require('fs');

flow(
  function () {
    this.next('LICENSE', 'README.md');
  },
  parallelEach(function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) this.end(err);
      self.next(data.length);
    });
  }),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
)();