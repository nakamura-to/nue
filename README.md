nue — An async control-flow library
===================================

nue is an async control-flow library suited for the node event loop.

## Installing

```
$ npm install nue
```

## Examples

### basic

```js
var nue = require('nue');
var flow = nue.flow;
var fs = require('fs');

var myFlow = flow(
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

myFlow();
```

### each

```js
var nue = require('nue');
var flow = nue.flow;
var each = nue.each;
var fs = require('fs');

var myFlow = flow(
  each(
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
  )
);

myFlow();
```

### parallel

```js
var nue = require('nue');
var flow = nue.flow;
var parallel = nue.parallel;
var fs = require('fs');

var myFlow = flow(
  parallel(
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
  )
);

myFlow();
```

### parallelEach

```js
var nue = require('nue');
var flow = nue.flow;
var parallelEach = nue.parallelEach;
var fs = require('fs');

var myFlow = flow(
  parallelEach(
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
  )
);

myFlow();
```
