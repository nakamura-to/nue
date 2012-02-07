var nue = require('../lib/nue');
var flow = nue.flow;
var fs = require('fs');

flow(
  function () {
    this.data = [];
    fs.readFile('LICENSE', this.callback);
  },
  function (data) {
    this.data.push(data.length);
    fs.readFile('README.md', this.callback);
  },
  function (data) {
    this.data.push(data.length);
    this.next();
  },
  function () {
    if (this.err) throw this.err;
    console.log(this.data);
  }
)();