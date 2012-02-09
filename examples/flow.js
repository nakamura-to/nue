var nue = require('../lib/nue');
var flow = nue.flow;
var fs = require('fs');

flow(
  function () {
    var results = [];
    fs.readFile('LICENSE', this.async(results));
  },
  function (results, data) {
    results.push(data.length);
    fs.readFile('README.md', this.async(results));
  },
  function (results, data) {
    results.push(data.length);
    this.next(results);
  },
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
)();