var flow = require('../index').flow;
var as = require('../index').as;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(file1, file2) {
    fs.readFile(file1, 'utf8', this.async({name: file1, content: as(1)}));
    fs.readFile(file2, 'utf8', this.async({name: file2, content: as(1)}));
    this.await();
  },
  function concat(file1, file2) {
    console.log(file1.name + ' and ' + file2.name + ' have been read.');
    this.next(file1.content + file2.content);
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow('file1', 'file2');