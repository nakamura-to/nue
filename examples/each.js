var nue = require('../lib/nue');
var flow = nue.flow;
var each = nue.each;
var fs = require('fs');

flow(
  function () {
    this.next('LICENSE', 'README.md', 'package.json');
  },
  each(function (name) {
    fs.readFile(name, this.callback);
  }),
  each(function (data) {
    this.next(data.length);
  }),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
)();