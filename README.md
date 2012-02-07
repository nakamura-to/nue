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
    fs.readFile(file, 'utf-8', this.callback);
  },
  function (data) {
    if (this.err) throw this.err;
    console.log(data);
  }
);

myFlow('file1');
```

## API

### flow([Function tasks...]) -> Function

Return a function which represents the control-flow.

> Arguments

* `tasks`: Optional. Tasks which are executed in series.

> Context

`this` context of the each task has following properties.

* `data`: Object. An object shared among control-flow.
* `next`: Function. A function to execute the next task.  
* `callback`: Function. This is same with `next` except the first parameter is an error object. 
* `end`: Function. A function to execute the last task to end the control-flow. The first parameter is an error object.

In addition to the above ones, the context of the last task has a following property.

* `err`: Object. An object represents an error which passed from the `end` function.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var fs = require('fs');

var myFlow = flow(
  function () {
    this.data = [];
    fs.readFile('file1', this.callback);
  },
  function (data) {
    this.data.push(data.length);
    fs.readFile('file2', this.callback);
  },
  function (data) {
    this.data.push(data.length);
    this.next();
  },
  function () {
    if (this.err) throw this.err;
    console.log(this.data);
  }
);

myFlow();
```

### each(Function worker(arg)) -> Function

Return a function to process each value in series.

> Arguments

* `worker`: Required. Function. A function to process an each value.
* `arg`: Optional. Object. An each value passed from the returned function.

> Context

`this` context of the `worker` has following properties.

* `data`: Object. An object shared in control-flow.
* `next`: Function. A function to process next value.
* `callback`: Function. This is same with `next` except the first parameter is an error object. 
* `end`: Function. A function to execute the last task to end the control-flow. The first parameter is an error object.
* `isFirst`: Boolean. Indicate whether the first process or not. 
* `isLast`: Boolean. Indicate whether the last process or not.
* `index`: Number. A process index.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var each = nue.each;
var fs = require('fs');

var myFlow = flow(
  function () {
    this.next('file1', 'file2', 'file3');
  },
  each(function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) throw this.end(err);
      self.next(data.length);
    });
  }),
  function (results) {
    if (err) throw err;
    console.log(results);
  }
);

myFlow();
```

### parallel([Function tasks...]) -> Function

Return a function to process tasks in parallel.

> Arguments

* `tasks`: Optional. Tasks which are executed in parallel.

> Context

`this` context of the `each task` has following properties.

* `data`: Object. An object shared in control-flow.
* `next`: Function. A function to complete the task and wait other tasks to complete.
* `callback`: Function. This is same with `next` except the first parameter is an error object. 
* `end`: Function. A function to execute the last task to end the control-flow. The first parameter is an error object.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var parallel = nue.parallel;
var fs = require('fs');

var myFlow = flow(
  function () {
    this.next('file1', 'file2');
  },
  parallel(
    function (name) {
      var self = this;
      fs.readFile(name, function (err, data) {
        if (err) this.end(err);
        self.join(data.length);
      });
    },
    function (path) {
      var self = this;
      fs.stat(path, function (err, stats) {
        if (err) this.end(err);
        self.join(stats.isFile());
      });
    }
  ),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
);

myFlow();
```

### parallelEach(Function worker(arg)) -> Function

Return a function to process each value in parallel.

> Arguments

* `worker`: Optional. Function. A function to process an each value.
* `arg`: Optional. Object. An each value passed from the begin callback.

> Context

`this` context of the `worker` has following properties.

* `data`: Object. An object shared in control-flow.
* `next`: Function. A function to complete the value processing and wait other value processing to complete.
* `callback`: Function. This is same with `next` except the first parameter is an error object. 
* `end`: Function. A function to execute the last task to end the control-flow. The first parameter is an error object.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var parallelEach = nue.parallelEach;
var fs = require('fs');

var myFlow = flow(
  function () {
    this.fork('file1', 'file2');
  },
  parallelEach(function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) this.end(err);
      self.join(data.length);
    });
  }),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
  }
);

myFlow();
```
