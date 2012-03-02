'use strict';

exports.name = 'nue';
exports.version = '0.4.0';
exports.flow = flow;
exports.parallel = parallel;
exports.as = as;


var util = require('util');
var assert = require('assert');


function flow() {
  if (arguments.length === 1 && typeof arguments[0] === 'string') {
    var flowName = arguments[0];
    return function () {
      return prepareFlow(flowName, normalizeArgs(arguments));
    };
  } else {
    return prepareFlow('', normalizeArgs(arguments));
  }
}

function normalizeArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return Array.prototype.slice.call(args);
}

function prepareFlow(flowName, functions) {
  function startFlow() {
    var steps = functions.length > 0 ? functions : [function () { this.next(); }];
    var args = Array.prototype.slice.call(arguments);
    runFlow(flowName, steps, args, this);
  }
  startFlow.stepName = flowName;
  return startFlow;
}

function runFlow(flowName, steps, callerArgs, callerContext) {
  var flow = new Flow(flowName, callerArgs, callerContext);
  var bootstrap = chainSteps(flow, steps);
  bootstrap.apply(callerContext, callerArgs);
}

function chainSteps(flow, steps) {
  assert.ok(steps.length > 0);
  var len = steps.length;
  var lastIndex = len - 1;
  var last = makeLastStep(steps[lastIndex], lastIndex);
  if (len === 1) {
    return last;
  }

  return steps.reduceRight(function chain(prev, curr, i) {
    return function step() {
      var next = i === len - 2 ? last : prev;
      var context = new StepContext(flow, curr.stepName || curr.name, i, next, last);
      try {
        curr.apply(context, arguments);
      } catch (e) {
        if (flow.isErrThrown) {
          throw e;
        }
        StepContext.prototype.endWith.call(context, e);
      }
    }
  });

  function makeLastStep(fn, index) {
    return function lastStep() {
      var context = new LastStepContext(flow, fn.stepName || fn.name, index);
      try {
        fn.apply(context, arguments);
      } catch (e) {
        flow.isErrThrown = true;
        throw e;
      }
    }
  }
}

function parallel() {
  if (arguments.length === 1 && typeof arguments[0] === 'string') {
    var flowName = arguments[0];
    return function () {
      return prepareParallel(flowName, normalizeArgs(arguments));
    };
  } else {
    return prepareParallel('', normalizeArgs(arguments));
  }
}

function prepareParallel(flowName, functions) {
  function startParallel() {
    assert.ok(this instanceof ContextBase, 'A `parallel` must be inside a flow or another parallel.');
    var args = Array.prototype.slice.call(arguments);
    runParallel(flowName, functions, args, this);
  }
  startParallel.stepName = flowName;
  return startParallel;
}

function runParallel(flowName, functions, callerArgs, callerContext) {
  callerContext.asyncEach(1)(functions, function (fn, group) {
    assert.equal(typeof fn, 'function', 'Each argument must be a function.');
    var callback = group();
    var end = function end() {
      callback.apply(null, [this.err].concat(Array.prototype.slice.call(arguments)));
      this.err = null;
    };
    end.stepName = (fn.stepName || fn.name) + '_end';
    flow(flowName)(fn, end).apply(callerContext, callerArgs);
  });
  callerContext.await();
}

function as(index) {
  return new As(index);
}

function normalizeArray(array) {
  return array.map(function (e) {
    switch(e.length) {
      case 0: return undefined;
      case 1: return e[0];
      default: return e;
    }
  });
}

function noop () {}


function As(index) {
  this.index = index;
}

function Flow(flowName, args, callerContext){
  this.flowName = flowName;
  this.args = args;
  this.callerContext = callerContext;
  this.isTopLevel = !(callerContext instanceof ContextBase);
  this.history = this.isTopLevel ? [] : callerContext.history;
  this.data = {};
  this.err = null;
  this.isErrThrown = false;
}

Flow.prototype.exit = function exit(err, args) {
  if (this.isTopLevel) {
    if (err) {
      throw new NueUnhandledError(err);
    }
  } else {
    if (err) {
      this.callerContext.endWith.call(this.callerContext, err);
    } else {
      this.callerContext.next.apply(this.callerContext, args);
    }
  }
};


function Async(next, endWith, flowName, stepName, stepIndex) {
  this.next = next;
  this.endWith = endWith;
  this.flowName = flowName;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
  this.index = 0;
  this.pending = 0;
  this.isCanceled = false;
  this.results = [];
  this.lock = true;
}

Async.SIGNAL_UNLOCK = {};

Async.prototype.createCallback = function createCallback() {
  var mapping = arguments[0];
  var i = mapping === Async.SIGNAL_UNLOCK ? -1 : this.index++;
  var self = this;
  this.pending++;
  return (function makeCallback(mapping, i) {
    return asyncCallback;

    function asyncCallback(err) {
      self.pending--;
      if (!self.isCanceled) {
        if (err) {
          self.isCanceled = true;
          self.endWith.call(null, new NueAsyncError(err, self.flowName, self.stepName, self.stepIndex, i));
        } else {
          if (mapping === Async.SIGNAL_UNLOCK) {
            self.lock = false;
          } else {
            self.results[i] = mapping ? mapArguments(mapping, arguments) : Array.prototype.slice.call(arguments, 1);
          }
          if (self.pending === 0 && !self.lock) {
            self.next.apply(null, normalizeArray(self.results));
          }
        }
      }
    }

    function mapArguments(mapping, args) {
      return Object.keys(mapping).reduce(function (result, key) {
        var value = mapping[key];
        if (value instanceof As) {
          result[key] = args[value.index];
        } else {
          result[key] = value;
        }
        return result;
      }, {});
    }

  }(mapping, i));

};

function ContextBase(flow, name, index, nextFn, lastFn) {
  this._flow = flow;
  this._nextFn = nextFn;
  this._lastFn = lastFn;
  this.err = flow.err;
  this.data = flow.data;
  this.flowName = flow.flowName;
  this.stepName = name;
  this.stepIndex = index;
  this.history = flow.history;
  this.history.push(new HistoryEntry(flow.flowName, name, index));
  this._asyncObj = new Async(this.next.bind(this), this.endWith.bind(this), flow.flowName, name, index);
}

ContextBase.DEFAULT_CONCURRENCY = 10;

ContextBase.prototype.async = function async() {
  return this._asyncObj.createCallback.apply(this._asyncObj, arguments);
};

ContextBase.prototype.asyncEach = function asyncEach() {
  var self = this;
  if (arguments.length === 1 && typeof arguments[0] === 'number') {
    var concurrency = arguments[0];
    return function () {
      waitAndConsume(concurrency, arguments[0], arguments[1]);
    };
  } else {
    waitAndConsume(ContextBase.DEFAULT_CONCURRENCY, arguments[0], arguments[1]);
  }

  function waitAndConsume(concurrency, array, worker) {
    assert.ok(Array.isArray(array), 'An argument `array` must be an array.');
    assert.equal(typeof worker, 'function', 'An argument `worker` must be a function.');
    var callback = self.async();
    var next = function next() {
      return callback.apply(self, [null].concat(Array.prototype.slice.call(arguments)));
    };
    var endWith = callback.bind(self);
    var async = new Async(next, endWith, self.flowName, self.stepName, self.stepIndex);    
    var group = function () {
      return async.createCallback.apply(async, arguments);
    };
    process.nextTick(function consumeArray() {
      consume(concurrency, array, worker, group, 0);
    });
  }

  function consume(concurrency, array, worker, group, index) {
    var len = array.length;
    for (var i = 0; i < concurrency && index < len; i++, index++) {
      worker.call(self, array[index], group, index, array);
    }
    if (index === len) {
      process.nextTick(group(Async.SIGNAL_UNLOCK));
    } else {
      process.nextTick(function consumeNext() {
        consume(concurrency, array, worker, group, index);
      });
    }
  }
  
};

ContextBase.prototype.exec = function exec(fn) {
  assert.ok(arguments.length > 1, 'Arguments length must be more than 1.');
  assert.equal(typeof fn, 'function', 'The first argument must be a function.');
  assert.equal(typeof arguments[arguments.length - 1], 'function', 'The last argument must be a function.');
  var callback = arguments[arguments.length - 1];
  var args = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
  var self = this;
  var end = function end() {
    callback.apply(null, [this.err].concat(Array.prototype.slice.call(arguments)));
    this.err = null;
  };
  end.stepName = (fn.stepName || fn.name) + '_end';
  process.nextTick(function execFlow() {
    flow('exec')(fn, end).apply(self, args);
  });
};

ContextBase.prototype.await = function await() {
  this.async(Async.SIGNAL_UNLOCK)();
};


function StepContext(flow, name, index, nextFn, lastFn) {
  ContextBase.call(this, flow, name, index, nextFn, lastFn);
}
util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function next() {
  disableContextMethods(this);
  this._flow.err = null;
  this._nextFn.apply(null, arguments);
};

StepContext.prototype.end = function end() {
  disableContextMethods(this);
  this._flow.err = null;
  this._lastFn.apply(null, arguments);
};

StepContext.prototype.endWith = function endWith(err) {
  disableContextMethods(this);
  this._flow.err = err;
  this._lastFn.call(null);
};


function LastStepContext(flow, name, index) {
  ContextBase.call(this, flow, name, index);
}
util.inherits(LastStepContext, ContextBase);

LastStepContext.prototype.next = function next() {
  disableContextMethods(this);
  this._flow.exit(this.err, Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.end = function end() {
  disableContextMethods(this);
  this._flow.exit(this.err, Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.endWith = function endWith(err) {
  disableContextMethods(this);
  this._flow.exit(err, []);
};


function disableContextMethods(context) {
  context.next = noop;
  context.end = noop;
  context.endWith = noop;
}


function HistoryEntry(flowName, stepName, stepIndex) {
  this.flowName = flowName;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
}

HistoryEntry.prototype.toString = function toString() {
  var flowName = this.flowName || '<anonymous>';
  var stepName = this.stepName || '<anonymous>';
  return flowName + '[' + this.stepIndex + ']:' + stepName;
};


function NueAsyncError(cause, flowName, stepName, stepIndex, asyncIndex) {
  this.cause = cause;
  this.flowName = flowName;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
  this.asyncIndex = asyncIndex;
  this.name = 'NueAsyncError';
  this.message = "An error in an async callback: " +
    "flowName = '" + flowName + "', stepName = '" + stepName +
    "', stepIndex = " + stepIndex + ', asyncIndex = ' + asyncIndex + '\n' +
    '+----- BEGIN CAUSE STACK -----+\n' + cause.stack + '\n' + '+----- END   CAUSE STACK -----+';
  Error.captureStackTrace(this, NueAsyncError);
}
util.inherits(NueAsyncError, Error);


function NueUnhandledError(cause) {
  this.cause = cause;
  this.name = 'NueUnhandledError';
  this.message = 'The error must be handled in a last step. ' +
    'To indicate error handling completed, set null to `this.err` before exiting the last step.\n' +
    '+----- BEGIN CAUSE STACK -----+\n' + cause.stack + '\n' + '+----- END   CAUSE STACK -----+';
  Error.captureStackTrace(this, NueUnhandledError);
}
util.inherits(NueUnhandledError, Error);
