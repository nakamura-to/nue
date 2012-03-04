nue — An async control-flow library
===================================

nue is an async control-flow library suited for node.js.

## Installing

```
$ npm install nue
```

## Example

```js
var flow = require('nue').flow;
var as = require('as').as;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(file1, file2) {
    fs.readFile(file1, 'utf8', this.async(as(1)));
    fs.readFile(file2, 'utf8', this.async(as(1)));
  },
  function concat(data1, data2) {
    this.next(data1 + data2);
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow('file1', 'file2');
```

## API

### flow([Function steps...]) -> Function

Return a function which represents the control-flow.

> Arguments

* `steps`: Optional. Optional functions to execute in series.

> Context

`this` context of each step in a flow has following properties.

* `next`: next([Object values...]) -> Void
 * A function to execute a next step immediately.  

* `async`: async([Object mapping]) -> Function
 * A function to accept an argument mapping definition for a next step and return a callback. 

* `asyncEach`: asyncEach(Array array, Function(element, group, elementIndex, traversedArray)) -> Void
 * A function to execute a provided function once per array element asynchronously. 
The `group` has a `async` function to accept an argument mapping definition and return a callback.

* `asyncEach`: asyncEach(Number concurrency) -> Function
 * A function to accept a concurrency number and return another `asyncEach` function which 
executes a provided function once per array element asynchronously with the specified cuncurrency. 
If you use another `forEach` function directly, default concurrency 10 is used.

* `exec`: exec(Function function([values...]), [Object args...], Function callback(err, [values...])) -> Void
 * A function to execute a specified `function` with `args` asynchronously. The `callback` are executed when the `function` is completed.  

* `end`: end([Object values...]) -> Void
 * A function to execute a last step immediately to end a control-flow.

* `endWith`: endWith(Error err) -> Void
 * A function to execute a last step immediately with an error to end a control-flow. 
The parameter `err` is referred as `this.err` in a last step.

* `data`: Object
 * A object to share arbitrary data between steps in a control-flow.

* `flowName`: String
 * A flow name.

* `stepName`: String
 * A step name.

* `history`: Array
 * An array to contain information about executed steps. This is an EXPERIMETAL FEATURE.

In addition to above ones, the context of a last step has a following property.

* `err`: Object
 * An object represents an error which is thrown with `throw`, passed to `this.endWith` or 
passed to an async callback as first argument.

### flow(String flowName) -> Function

Accept a flow name and return another `flow` function.

> Arguments

* `flowName`: Required. A flow name to be used for debug.

### parallel([Function steps...]) -> Function

Return a function which represents the parallel control-flow.
The `parallel` must be nested inside a `flow` or another `parallel`.

> Arguments

* `steps`: Optional. Optional functions to execute in parallel.

### parallel(String flowName) -> Function

Accept a flow name and return another `parallel` function.

> Arguments

* `flowName`: Required. A flow name to be used for debug.

### as(Number index) -> Object

> Arguments

* `index`: Required. An index to map an asynchronous callback argument to a next step argument.

## Flow Nesting

A flow can be nested.

```js
var flow = require('nue').flow;
var as = require('as').as;
var fs = require('fs');

var subFlow = flow('subFlow')(
  function readFile(file) {
    fs.readFile(file, 'utf8', this.async(as(1)));
  }
);

var mainFlow = flow('mainFlow')(
  function start() {
    this.next('file1');
  },
  subFlow,
  function end(result) {
    if (this.err) throw this.err;
    console.log(result);
    console.log('done');
    this.next();
  }
);

mainFlow();
```

## Flow Nesting and Asynchronous Execution

A nested sub-flow can be executed asynchronously.

```js
var flow = require('nue').flow;
var as = require('as').as;
var fs = require('fs');

var subFlow = flow('subFlow')(
  function readFile(file) {
    fs.readFile(file, 'utf8', this.async(as(1)));
  }
);

var mainFlow = flow('mainFlow')(
  function start() {
    this.exec(subFlow, 'file1', this.async(as(1)));
    this.exec(subFlow, 'file2', this.async(as(1)));
  },
  function end(data1, data2) {
    if (this.err) throw this.err;
    console.log(data1 + data2);
    console.log('done');
    this.next();
  }
);

mainFlow();
```

## Parallel Flow

In following example, the flow `par1-1` and `par1-2` are executed in parallel.

```js
var flow = require('nue').flow;
var parallel = require('nue').parallel;

var myFlow = flow('main')(
  function one() { this.next(); },
  function two() { this.next(); },
  parallel('par1')(
    flow('par1-1')(
      function three() { this.next(); },
      function four() { this.next(); }
    ),
    flow('par1-2')(
      function five() { this.next(); },
      function six() { this.next(); }
    )
  ),
  function seven() { this.next(); },
  function eight() { this.next(); },
  function allDone() {
    if (this.err) throw this.err;
    console.log(this.history);
    this.next();
  }
);

myFlow();
```

## Arguments Passing Between Functions

arguments are passed with `this.next` or `this.async`.

```js
var flow = require('nue').flow;
var as = require('as').as;
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
```

`this.async` can be called in loop.
Following example produces same results with above example.

```js
var flow = require('nue').flow;
var as = require('as').as;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(files) {
    this.asyncEach(files, function (file, group) {
      fs.readFile(file, 'utf8', group.async({name: file, data: as(1)}));
    });
  },
  function concat(files) {
    var names = files.map(function (f) { return f.name; });
    var contents = files.map(function (f) { return f.data});
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
```

## Data Sharing Between Functions

Each step in a flow can share data through `this.data`.
`this.data` is shared in a same flow.
A nesting flow and any nested flows can't share `this.data`.

```js
var flow = require('nue').flow;
var as = require('as').as;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(file1, file2) {
    this.data.file1 = file1;
    this.data.file2 = file2;
    fs.readFile(file1, 'utf8', this.async(as(1)));
    fs.readFile(file2, 'utf8', this.async(as(1)));
  },
  function concat(data1, data2) {
    this.next(data1 + data2);
  },
  function end(data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log(this.data.file1 + ' and ' + this.data.file2 + ' are concatenated.');
    this.next();
  }
);

myFlow('file1', 'file2');
```

## Error Handling

In a last step in a flow, `this.err` represents an error which is thrown with `throw`, passed to `this.endWith` or passed to an async callback as first argument. 
To indicate error handling completion, you must assign `null` to `this.err`.

```js
var flow = require('nue').flow;
var as = require('as').as;
var fs = require('fs');

var myFlow = flow('myFlow')(
  function readFiles(file1, file2) {
    if (!file1) this.endWith(new Error('file1 is illegal.'));
    if (!file2) this.endWith(new Error('file2 is illegal.'));
    fs.readFile(file1, 'utf8', this.async(as(1)));
    fs.readFile(file2, 'utf8', this.async(as(1)));
  },
  function concat(data1, data2) {
    this.next(data1 + data2);
  },
  function end(data) {
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
```

## Unit Test with Mocha

Following example shows how to test a flow and a function with [Mocha](http://visionmedia.github.com/mocha/).

```js
var flow = require('nue').flow;
var as = require('as').as;
var fs = require('fs');

var concatFiles = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf8', this.async(as(1)));
    fs.readFile(file2, 'utf8', this.async(as(1)));
  },
  function (data1, data2) {
    this.next(data1 + data2);
  }
);

function read(file) {
  fs.readFile(file, 'utf8', this.async(as(1)));
}

var assert = require('assert');

describe('flow `concatFiles`', function () {
  it('can be tested', function (done) {
    flow(
      concatFiles,
      function (data) {
        if (this.err) throw this.err;
        assert.strictEqual(data, 'FILE1FILE2');
        done();
      }
    )('file1', 'file2');
  });
});

describe('function `read`', function () {
  it('can be tested', function (done) {
    flow(
      read,
      function (data) {
        if (this.err) throw this.err;
        assert.strictEqual(data, 'FILE1');
        done();
      }
    )('file1');
  });
});
```
