var flow = require('../index').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf8', this.async());
    fs.readFile(file2, 'utf8', this.async());
  },
  function (data1, data2) {
    this.next(data1 + data2);
  },
  function (data) {
    if (this.err) {
      // handle error
      console.log(this.err.message);
      // indicate error handling completion
      this.err = null;
    } else {
      console.log(data);
    }
    console.log('done');
    this.next();
  }
);

myFlow('file1', 'non-existent-file');