var flow = require('../index').flow;
var as = require('../index').as;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(files) {
    this.asyncEach(files, function (file, group) {
      fs.readFile(file, 'utf8', group({name: file, content: as(1)}));
    });
    this.await();
  },
  function concat(files) {
    var names = files.map(function (f) { return f.name; });
    var contents = files.map(function (f) { return f.content});
    console.log(names.join(' and ') + ' have been read.');
    this.next(contents.join(''));
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow(['file1', 'file2']);

