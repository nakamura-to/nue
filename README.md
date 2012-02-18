nue — An async control-flow library
===================================

nue is an async control-flow library suited for the node event loop.

## Installing

```
$ npm install nue
```

## Example

```js
var flow = require('nue').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf-8', this.async());
    fs.readFile(file2, 'utf-8', this.async());
  },
  function (data1, data2) {
    this.next(data1 + data2);
  },
  function (data) {
    console.log(data);
    console.log('done');
  }
);

myFlow('file1', 'file2');
```

## API

<a name="flow" />
### flow([Function tasks...]) -> Function

Return a function which represents the control-flow.

> Arguments

* `tasks`: Optional. Tasks which are executed in series.

> Context

`this` context of the each task has following properties.

* `next`: Function. A function to execute a next task.  
* `async`: Function. A function to accept parameters for a next task and return a callback. 
* `end`: Function. A function to execute a last task to end a control-flow. The first parameter is an error object.
* 'queue`: Function. A function to create a serial queue object.
* 'parallelQueue`: Function. A function to create a parallel queue object.
* 'data': Object : A object to share arbitrary data among functions in a control-flow.

In addition to the above ones, the context of the last task has a following property.

* `err`: Object. An object represents an error which passed from the `end` function.

## Data Sharing Among Functions

```js
var flow = require('nue').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    this.data.file1Name = file1;
    this.data.file2Name = file2;
    fs.readFile(file1, 'utf-8', this.async());
    fs.readFile(file2, 'utf-8', this.async());
  },
  function (data1, data2) {
    this.next(data1 + data2);
  },
  function (data) {
    console.log(data);
    console.log(this.data.file1 ' and ' + this.data.file2 ' are concatenated.');
  }
);

myFlow('file1', 'file2');
```

## Error Handling

```js
var flow = require('nue').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf-8', this.async());
    fs.readFile(file2, 'utf-8', this.async());
  },
  function (data1, data2) {
    this.next(data1 + data2);
  },
  function (data) {
    if (this.err) {
      // handle error
      ...
      // indicate error handling completion
      this.err = null;
    }
    console.log(data);
    console.log('done');
  }
);

myFlow('file1', 'file2');
```
