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
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf8', this.async());
    fs.readFile(file2, 'utf8', this.async());
  },
  function (data1, data2) {
    this.next(data1 + data2);
  },
  function (data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow('file1', 'file2');
```

## API

<a name="flow" />
### flow([Function functions...]) -> Function

Return a function which represents the control-flow.

> Arguments

* `functions`: Optional. Functions which are executed in series.

> Context

`this` context of each function in a flow has following properties.

* `next`: Function. A function to execute a next function immediately.  
* `async`: Function. A function to accept parameters for a next function and return a callback. 
* `end`: Function. A function to execute a last function to end a control-flow. The first parameter is an error object.
* `data`: Object : A object to share arbitrary data between functions in a control-flow.

In addition to the above ones, the context of the last function has a following property.

* `err`: Object. An object represents an error which passed from the `end` function.

## Flow Nesting

A flow can be nested.

```js
var flow = require('nue').flow;
var fs = require('fs');

var subFlow = flow(
  function (file) {
    fs.readFile(file, 'utf8', this.async());
  }
);

var mainFlow = flow(
  function () {
    this.next('file1');
  },
  subFlow,
  function (data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
  }
);

mainFlow();
```

## Arguments Passing Between Functions

arguments are passed with `this.next` or `this.async`.

```js
var flow = require('nue').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf8', this.async(file1));
    fs.readFile(file2, 'utf8', this.async(file2));
  },
  function (file1, data1, file2, data2) {
    console.log(file1 + ' and ' + file2 + ' have been read.');
    this.next(data1 + data2);
  },
  function (data) {
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
var fs = require('fs');

var myFlow = flow(
  function (files) {
    process.nextTick(this.async(files));
    files.forEach(function (file) {
      fs.readFile(file, 'utf8', this.async());
    }.bind(this));
  },
  function (files) {
    var data = Array.prototype.slice.call(arguments, 1).join('');
    console.log(files.join(' and ') + ' have been read.');
    this.next(data);
  },
  function (data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log('done');
    this.next();
  }
);

myFlow(['file1', 'file2']);
```

## Data Sharing Between Functions

Each function in a flow can share data through `this.data`.
`this.data` is shared in a same flow.
A nesting flow and any nested flows can't share `this.data`.

```js
var flow = require('nue').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    this.data.file1 = file1;
    this.data.file2 = file2;
    fs.readFile(file1, 'utf8', this.async());
    fs.readFile(file2, 'utf8', this.async());
  },
  function (data1, data2) {
    this.next(data1 + data2);
  },
  function (data) {
    if (this.err) throw this.err;
    console.log(data);
    console.log(this.data.file1 + ' and ' + this.data.file2 + ' are concatenated.');
    this.next();
  }
);

myFlow('file1', 'file2');
```

## Error Handling

In a last function in a flow, `this.err` represents an error thrown in the flow.
To indicate error handling completion, you must assign `null` to `this.err`.

```js
var flow = require('nue').flow;
var fs = require('fs');

var myFlow = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf8', this.async());
    fs.readFile(file2, 'utf8', this.async());
  },
  function (data1, data2) {
    this.next(data1 + data2);
  },
  function (data) {
    if (this.err) {
      // handle error
      console.log(this.err);
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

Following example shows how to test a flow and a function with Mocha.

```js
var flow = require('nue').flow;
var fs = require('fs');

var concatFiles = flow(
  function (file1, file2) {
    fs.readFile(file1, 'utf8', this.async());
    fs.readFile(file2, 'utf8', this.async());
  },
  function (data1, data2) {
    this.next(data1 + data2);
  }
);

function read(file) {
  fs.readFile(file, 'utf8', this.async());
}

var assert = require('assert');

describe('concatFiles flow', function () {
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

describe('read function', function () {
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
