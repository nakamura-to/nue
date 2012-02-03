nue — An async control-flow library
===================================

nue is an async control-flow library suited for the node event loop.

## Installing

```
$ npm install nue
```

## Example

### serial

```js
var nue = require('nue');
var start = nue.start;
var serial = nue.serial;
var fs = require('fs');

start(serial(
  function (){
    this.data = [];
    fs.readFile('file1', this.next);
  },
  function (err, data){
    if (err) throw this.end(err);
    this.data.push(data.length);
    fs.readFile('file2', this.next);
  },
  function (err, data){
    if (err) throw this.end(err);
    this.data.push(data.length);
    this.next();
  },
  function (err) {
    if (err) throw err;
    console.log(this.data);
  }
));
```

### serialEach

```js
var nue = require('nue');
var start = nue.start;
var serialEach = nue.serialEach;
var fs = require('fs');

start(serialEach(
  function () {
    this.begin('file1', 'file2', 'file3');
  },
  function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) throw this.end(err);
      self.next(data.length);
    });
  },
  function (err, results) {
    if (err) throw err;
    console.log(results);
  }
));
```

### parallel

```js
var nue = require('nue');
var start = nue.start;
var parallel = nue.parallel;
var fs = require('fs');

start(parallel(
  function () {
    this.fork('file1', 'file2');
  },
  [
    function (name) {
      var self = this;
      fs.readFile(name, function (err, data) {
        if (err) this.err(err);
        self.join(data.length);
      });
    },
    function (path) {
      var self = this;
      fs.stat(path, function (err, stats) {
        if (err) this.err(err);
        self.join(stats.isFile());
      });
    }
  ],
  function (err, results) {
    if (err) throw err;
    console.log(results);
  }
));
```

### parallelEach

```js
var nue = require('nue');
var start = nue.start;
var parallelEach = nue.parallelEach;
var fs = require('fs');

start(parallelEach(
  function () {
    this.begin('file1', 'file2');
  },
  function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) this.end(err);
      self.join(data.length);
    });
  },
  function (err, results) {
    if (err) throw err;
    console.log(results);
  }
));
```
