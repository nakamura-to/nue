var flow = require('../index').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    this.next(file1, file2);
  },
  function readFile(file1, file2) {
    fs.readFile(file1, 'utf8', this.async());
    fs.readFile(file2, 'utf8', this.async());
  },
  function cancat(data1, data2) {
    this.next(data1 + data2);
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);
myFlow('file1', 'file2');