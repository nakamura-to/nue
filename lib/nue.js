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

  function prepareFlow(flowName, functions) {
    function startFlow() {
      var isTopLevel = !(this instanceof ContextBase);
      var flow = {
        flowName: flowName,
        context: this,
        isTopLevel: isTopLevel,
        history: isTopLevel ? [] : this.history,
        data: {},
        err: null
      };
      var steps = functions.length > 0 ? functions : [function () { this.next(); }];
      var head = chainSteps(flow, steps);
      head.apply(this, arguments);
    }
    startFlow.stepName = flowName;
    return startFlow;
  }

  function chainSteps(flow, steps) {
    var len = steps.length;
    var lastIndex = len - 1;
    var last = makeLastStep(steps[lastIndex], lastIndex);
    var isThrown = false;
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
          if (isThrown) {
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
          isThrown = true;
          throw e;
        }
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

  function prepareParallel(flowName, functions) {
    function startParallel() {
      assert.ok(this instanceof ContextBase, 'A `parallel` must be inside a flow or another parallel.');
      var self = this;
      var args = Array.prototype.slice.call(arguments);
      self.asyncEach(1)(functions, function (fn, group) {
        assert.equal(typeof fn, 'function', 'Each argument must be a function.');
        var callback = group();
        var end = function end() {
          callback.apply(null, [this.err].concat(Array.prototype.slice.call(arguments)));
          this.err = null;
        };
        end.stepName = (fn.stepName || fn.name) + '_end';
        flow(flowName)(fn, end).apply(self, args);
      });
      process.nextTick(self.async(Async.SIGNAL_UNLOCK));
    }
    startParallel.stepName = flowName;
    return startParallel;
  }
}

function as(index) {
  return new As(index);
}

function normalizeArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return Array.prototype.slice.call(args);
}

function noop () {}


function As(index) {
  this.index = index;
}


function Async(lock, next, endWith, flowName, stepName, stepIndex) {
  this.lock = lock;
  this.next = next;
  this.endWith = endWith;
  this.flowName = flowName;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
  this.index = 0;
  this.pending = 0;
  this.isCanceled = false;
  this.results = [];
}

Async.SIGNAL_UNLOCK = {};

Async.prototype.makeCallback = function makeCallback(include1stArg, mapping) {
  assert.ok(typeof include1stArg === 'boolean' || typeof include1stArg === 'object' || include1stArg === undefined, 'The first argument must be a boolean or an object.');
  if (typeof include1stArg === 'object') {
    mapping = include1stArg;
    include1stArg = false;
  }
  var index = mapping === Async.SIGNAL_UNLOCK ? -1 : this.index++;
  var self = this;
  this.pending++;
  return function asyncCallback(err) {
    self.pending--;
    if (!self.isCanceled) {
      if (!include1stArg && err) {
        self.isCanceled = true;
        self.endWith.call(null, new NueAsyncError(err, self.flowName, self.stepName, self.stepIndex, index));
      } else {
        if (mapping === Async.SIGNAL_UNLOCK) {
          self.lock = false;
        } else {
          self.results[index] = mapping ? mapArguments(mapping, arguments) : Array.prototype.slice.call(arguments, include1stArg ? 0 : 1);
        }
        if (self.pending === 0 && !self.lock) {
          self.next.apply(null, normalizeArray(self.results));
        }
      }
    }
  };

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

  function normalizeArray(array) {
    return array.map(function (e) {
      switch(e.length) {
        case 0: return undefined;
        case 1: return e[0];
        default: return e;
      }
    });
  }
};

function ContextBase(flow, name, index, next, last) {
  this._flow = flow;
  this._next = next;
  this._last = last;
  this.err = flow.err;
  this.data = flow.data;
  this.flowName = flow.flowName;
  this.stepName = name;
  this.stepIndex = index;
  this.history = flow.history;
  this.history.push(new HistoryEntry(flow.flowName, name, index));
  this._asyncObj = new Async(false, this.next.bind(this), this.endWith.bind(this), flow.flowName, name, index);
}

ContextBase.DEFAULT_CONCURRENCY = 10;

ContextBase.prototype._disable = function _disable() {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
};

ContextBase.prototype.async = function async() {
  return this._asyncObj.makeCallback.apply(this._asyncObj, arguments);
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
    var async = new Async(true, next, endWith, self.flowName, self.stepName, self.stepIndex);    
    var group = function () {
      return async.makeCallback.apply(async, arguments);
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


function StepContext(flow, name, index, next, last) {
  ContextBase.call(this, flow, name, index, next, last);
}
util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function next() {
  this._disable();
  this._flow.err = null;
  this._next.apply(null, arguments);
};

StepContext.prototype.end = function end() {
  this._disable();
  this._flow.err = null;
  this._last.apply(null, arguments);
};

StepContext.prototype.endWith = function endWith(err) {
  this._disable();
  this._flow.err = err;
  this._last.call(null);
};


function LastStepContext(flow, name, index) {
  ContextBase.call(this, flow, name, index);
}
util.inherits(LastStepContext, ContextBase);

LastStepContext.prototype.next = function next() {
  this._disable();
  this._exit(Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.end = function end() {
  this._disable();
  this._exit(Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.endWith = function endWith(err) {
  this._disable();
  this.err = err;
  this._exit([]);
};

LastStepContext.prototype._exit = function _exit(args) {
  if (this._flow.isTopLevel) {
    if (this.err) {
      throw new NueUnhandledError(this.err);
    }
  } else {
    if (this.err) {
      this._flow.context.endWith.call(this._flow.context, this.err);
    } else {
      this._flow.context.next.apply(this._flow.context, args);
    }
  }
};

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
