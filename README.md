nue — An async control-flow library
===================================

nue is an async control-flow library suited for the node event loop.

## Installing

```
$ npm install nue
```

## Example

```js
var nue = require('nue');
var flow = nue.flow;
var fs = require('fs');

var myFlow = flow(
  function (file) {
    fs.readFile(file, this.next);
  },
  function (err, data) {
    console.log(data);
  }
);

myFlow(['file1']);
```

## API

### flow([Function tasks...]) -> Function

Return a function which represents the control-flow.

> Arguments

* tasks: Optional. Tasks which are executed in series.
 
> Example

```js
var nue = require('nue');
var flow = nue.flow;
var fs = require('fs');

var myFlow = flow(
  function () {
    this.data = [];
    fs.readFile('file1', this.next);
  },
  function (err, data) {
    if (err) throw this.end(err);
    this.data.push(data.length);
    fs.readFile('file2', this.next);
  },
  function (err, data) {
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

### each(Function begin(beginArg), Function process(processArg), Function end(err, results)) -> Function

Return a function to process each value in series.

> Arguments

* begin: Required. Function. A callback to prepare values.
* beginArg: Optional. Object. A value passed from the previous task.
* process: Required. Function. A callback to process values.
* processArg: Optional. Object. An each value passed from the begin callback.
* end: Optional. Function. An optional callback to run once all the values have been processed. 
* err: Required. Error. An error passed from the process callback.
* results: Optional. Array. Values passed from the process callback.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var each = nue.each;
var fs = require('fs');

var myFlow = flow(
  each(
    function () {
      this.next('file1', 'file2', 'file3');
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

### parallel(Function begin(beginArg), Array tasks, Function end(err, results)) -> Function

Return a function to process tasks in parallel.

> Arguments

* begin: Required. Function. A callback to prepare values.
* beginArg: Optional. Object. A value passed from the previous task.
* tasks: Required. Array. An array of function, which are executed in parallel.
* end: Optional. Function. An optional callback to run once all the tasks have completed. 
* err: Required. Error. An error object passed from the process callback.
* results: Optional. Array. Values passed from the tasks.

> Example

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

### parallelEach(Function begin(beginArg), Function process(processArg), Function end(err, results)) -> Function

Return a function to process each value in parallel.

> Arguments

* begin: Required. Function. A callback to prepare values.
* beginArg: Optional. Object. A value passed from the previous task.
* process: Required. Function. A callback to process values.
* processArg: Optional. Object. An each value passed from the begin callback.
* end: Optional. Function. An optional callback to run once all the values have been processed. 
* err: Required. Error. An error object passed from the process callback.
* results: Optional. Array. Values passed from the process callback.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var parallelEach = nue.parallelEach;
var fs = require('fs');

var myFlow = flow(
  parallelEach(
    function () {
      this.fork('file1', 'file2');
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
