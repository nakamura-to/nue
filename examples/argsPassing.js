var flow = require('../index').flow;
var as = require('../index').as;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(file1, file2) {
    fs.readFile(file1, 'utf8', this.async({name: file1, data: as(1)}));
    fs.readFile(file2, 'utf8', this.async({name: file2, data: as(1)}));
  },
  function concat(f1, f2) {
    console.log(f1.name + ' and ' + f2.name + ' have been read.');
    this.next(f1.data + f2.data);
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow('file1', 'file2');