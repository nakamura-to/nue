var flow = require('../index').flow;
var fs = require('fs');

var subFlow = flow(
  function readFile(file) {
    fs.readFile(file, 'utf8', this.async());
  }
);

var mainFlow = flow(
  function start() {
    this.next('file1');
  },
  subFlow,
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
  }
);

mainFlow();