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
    fs.readFile(file, 'utf-8', this.async());
  },
  function (data) {
    if (this.err) throw this.err;
    console.log(data);
  }
);

myFlow('file1');
```

## API Overview

### Core

* [flow](#flow)


### Serial

* [map](#map)
* forEach
* filter
* every
* some
* queue

### Parallel

* [parallel](#parallel)
* [parallelMap](#parallelMap)
* parallelForEach
* parallelFilter
* parallelEvery
* parallelSome
* parallelQueue

## API Detail

<a name="flow" />
### flow([Function tasks...]) -> Function

Return a function which represents the control-flow.

> Arguments

* `tasks`: Optional. Tasks which are executed in series.

> Context

`this` context of the each task has following properties.

* `next`: Function. A function to execute a next task.  
* `async`: Function. A function to accept parameters for a next task and return a callback, which executes a next task. 
* `end`: Function. A function to execute a last task to end a control-flow. The first parameter is an error object.

In addition to the above ones, the context of the last task has a following property.

* `err`: Object. An object represents an error which passed from the `end` function.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var fs = require('fs');

var myFlow = flow(
  function () {
    var results = [];
    fs.readFile('file1', this.async(results));
  },
  function (results, data) {
    results.push(data.length);
    fs.readFile('file2', this.async(results));
  },
  function (results, data) {
    results.push(data.length);
    this.next(results);
  },
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
    this.next();
  }
);

myFlow();
```

<a name="map" />
### map(Function worker(arg)) -> Function

Return a function to process each value in series.

> Arguments

* `worker`: Required. Function. A function to process each value.
* `arg`: Optional. Object. Each value passed from a previous task.

> Context

`this` context of the `worker` has following properties.

* `next`: Function. A function to process next value.
* `async`: Function. A function to accept parameters for a next task and return a callback, which process next value. 
* `end`: Function. A function to execute a last task to end a control-flow. The first parameter is an error object.
* `isFirst`: Boolean. Indicate whether the worker is handling the first value or not. 
* `isLast`: Boolean. Indicate whether the worker is handling the last value or not.
* `index`: Number. An index of value.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var map = nue.map;
var fs = require('fs');

var myFlow = flow(
  function () {
    this.next('file1', 'file2', 'file3');
  },
  map(function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) throw this.end(err);
      self.next(data.length);
    });
  }),
  function (results) {
    if (err) throw err;
    console.log(results);
    this.next();
  }
);

myFlow();
```

<a name="parallel" />
### parallel([Function tasks...]) -> Function

Return a function to execute tasks in parallel.

> Arguments

* `tasks`: Optional. Tasks which are executed in parallel.

> Context

`this` context of each task has following properties.

* `next`: Function. A function to complete a task and wait other tasks to complete.
* `async`: Function. A function to accept parameters for a next task and return a callback, which complete a task and wait other tasks to complete. 
* `end`: Function. A function to execute a last task to end a control-flow. The first parameter is an error object.

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
        self.next(data.length);
      });
    },
    function (path) {
      var self = this;
      fs.stat(path, function (err, stats) {
        if (err) this.end(err);
        self.next(stats.isFile());
      });
    }
  ),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
    this.next();
  }
);

myFlow();
```

<a name="parallelMap" />
### parallelMap(Function worker(arg)) -> Function

Return a function to process each value in parallel.

> Arguments

* `worker`: Optional. Function. A function to process each value.
* `arg`: Optional. Object. Each value passed from a previous task.

> Context

`this` context of the `worker` has following properties.

* `next`: Function. A function to complete a processing and wait other processing to complete.
* `async`: Function. A function to accept parameters for a next task and return a callback, which complete a processing and wait other processing to complete. 
* `end`: Function. A function to execute a last task to end a control-flow. The first parameter is an error object.

> Example

```js
var nue = require('nue');
var flow = nue.flow;
var parallelMap = nue.parallelMap;
var fs = require('fs');

var myFlow = flow(
  function () {
    this.next('file1', 'file2');
  },
  parallelMap(function (name) {
    var self = this;
    fs.readFile(name, function (err, data) {
      if (err) this.end(err);
      self.next(data.length);
    });
  }),
  function (results) {
    if (this.err) throw this.err;
    console.log(results);
    this.next();
  }
);

myFlow();
```
