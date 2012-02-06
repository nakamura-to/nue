var nue = require('../lib/nue');
var flow = nue.flow;
var each = nue.each;
var fs = require('fs');

flow(
  function () {
    this.next(null, ['LICENSE', 'README.md', 'package.json']);
  },
  each(function (name) {
    fs.readFile(name, this.next);
  }),
  each(function (data) {
    this.next(null, data.length);
  }),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
)();