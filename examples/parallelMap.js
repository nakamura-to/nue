var nue = require('../lib/nue');
var flow = nue.flow;
var parallelMap = nue.parallelMap;
var fs = require('fs');

flow(
  function () {
    this.next('LICENSE', 'README.md');
  },
  parallelMap(function (name) {
    fs.readFile(name, this.async());
  }),
  parallelMap(function (data) {
    this.next(data.length);
  }),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
)();