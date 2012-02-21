var flow = require('../index').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf8', this.async(file1));
    fs.readFile(file2, 'utf8', this.async(file2));
  },
  function (file1, data1, file2, data2) {
    console.log(file1 + ' and ' + file2 + ' have been read.');
    this.next(data1 + data2);
  },
  function (data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow('file1', 'file2');