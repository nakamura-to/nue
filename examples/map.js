var nue = require('../lib/nue');
var flow = nue.flow;
var map = nue.map;
var fs = require('fs');

flow(
  function () {
    this.next('LICENSE', 'README.md', 'package.json');
  },
  map(function (name) {
    fs.readFile(name, this.async());
  }),
  map(function (data) {
    this.next(data.length);
  }),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
)();