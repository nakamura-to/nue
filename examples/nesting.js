var flow = require('../index').flow;
var fs = require('fs');

var subFlow = flow(
  function (file) {
    fs.readFile(file, 'utf8', this.async());
  }
);

var mainFlow = flow(
  function () {
    this.next('file1');
  },
  subFlow,
  function (data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
  }
);

mainFlow();