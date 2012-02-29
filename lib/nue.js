'use strict';

exports.name = 'nue';
exports.version = '0.4.0';
exports.flow = flow;
exports.parallel = parallel;


var EventEmitter = require('events').EventEmitter;
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
    var steps = functions.length > 0 ? functions : function () { this.next(); };
    var args = Array.prototype.slice.call(arguments);
    runFlow(flowName, chainSteps(steps), args, this);
  }
  startFlow.stepName = flowName;
  return startFlow;
}

function runFlow(flowName, steps, callerArgs, callerContext) {
  var flow = new Flow(flowName, callerArgs, callerContext, steps[steps.length - 1]);
  if (steps.length > 1) {
    runStep(flow, steps[0]);
  } else {
    runLastStep(flow);
  }
}

function chainSteps(steps) {
  steps = steps.map(function (step, i) {
    assert.equal(typeof step, 'function', 'Each argument must be a function.');
    var fn = function applyStep() {
      step.apply(this, arguments);
    };
    fn.stepName = step.stepName || step.name;
    fn.stepIndex = i;
    attachEmitter(fn);
    return fn;
  });
  var len = steps.length - 1;
  for (var i = 0; i < len; i++) {
    (function chain(i, step, next) {
      if (i < len - 1) {
        step.events.once('done', function startStep(flow) {
          runStep(flow, next);
        });
      } else {
        step.events.once('done', function startLastStep(flow) {
          runLastStep(flow);
        });
      }
    }(i, steps[i], steps[i + 1]));
  }
  return steps;
}

function runStep(flow, step) {
  var context = new StepContext(flow, step);
  try {
    step.apply(context, flow.args);
  } catch (e) {
    if (flow.isErrThrown) {
      throw e;
    }
    StepContext.prototype.endWith.call(context, e);
  }
}

function runLastStep(flow) {
  var context = new LastStepContext(flow);
  try {
    flow.lastStep.apply(context, flow.args);
  } catch (e) {
    flow.isErrThrown = true;
    throw e;
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
  callerContext.parallelEach(1)(functions, function (fn, group) {
    assert.equal(typeof fn, 'function', 'Each argument must be a function.');
    var callback = group();
    var end = function end() {
      callback.apply(null, [this.err].concat(this.args));
      this.err = null;
    };
    end.stepName = (fn.stepName || fn.name) + '_end';
    flow(flowName)(fn, end).apply(callerContext, callerArgs);
  });
}

function attachEmitter(target) {
  if (!target.__nue__) {
    target.events = new EventEmitter();
    target.__nue__ = true;
  }
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


function Flow(flowName, args, callerContext, lastStep){
  this.flowName = flowName;
  this.args = args;
  this.callerContext = callerContext;
  this.lastStep = lastStep;
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


function ContextBase(flow, step) {
  this._flow = flow;
  this._step = step;
  this._stepIndex = step.stepIndex;
  this._asyncIndex = 0;
  this._asyncCallCount = 0;
  this._isAsyncCanceled = false;
  this._results = [];
  this.err = flow.err;
  this.args = flow.args;
  this.data = flow.data;
  this.flowName = flow.flowName;
  this.stepName = step.stepName;
  this.history = flow.history;
  this.history.push(new HistoryEntry(this.flowName, this.stepName, this._stepIndex));
  this.next = this.next.bind(this);
  this.end = this.end.bind(this);
  this.endWith = this.endWith.bind(this);
  this.async = this.async.bind(this);
  this.parallelEach = this.parallelEach.bind(this);
  this.exec = this.exec.bind(this);
}

ContextBase.SIGNAL_UNLOCK = {};

ContextBase.DEFAULT_CONCURRENCY = 10;

ContextBase.prototype.async = function async() {
  this._asyncCallCount++;
  var args = Array.prototype.slice.call(arguments);
  var self = this;
  return (function makeCallback(args, asyncIndex) {
    return asyncCallback;

    function asyncCallback(err) {
      self._asyncCallCount--;
      if (!self._isAsyncCanceled) {
        if (err) {
          self._isAsyncCanceled = true;
          self.endWith.call(self, new NueAsyncError(err, self.flowName, self.stepName, self._stepIndex, asyncIndex));
        } else {
          self._results[asyncIndex] = args.concat(Array.prototype.slice.call(arguments, 1));
          if (self._asyncCallCount === 0) {
            self.next.apply(self, normalizeArray(self._results));
          }
        }
      }
    }
  }(args, this._asyncIndex++));
};

ContextBase.prototype._asyncGroup = function _asyncGroup() {
  var realCallback = this.async().bind(this);
  var asyncCallCount = 0;
  var asyncIndex = 0;
  var lock = true;
  var results = [];
  return asyncGroup;

  function asyncGroup() {
    asyncCallCount++;
    var args = Array.prototype.slice.call(arguments);
    return (function makeCallback(args, asyncIndex) {
      return asyncGroupCallback;

      function asyncGroupCallback(err) {
        asyncCallCount--;
        if (err) {
          realCallback(err);
        } else {
          if (args[0] === ContextBase.SIGNAL_UNLOCK) {
            lock = false;
          } else {
            results[asyncIndex] = args.concat(Array.prototype.slice.call(arguments, 1));
          }
          if (asyncCallCount === 0 && !lock) {
            realCallback(null, normalizeArray(results));
          }
        }
      }
    }(args, asyncIndex++));
  }
};

ContextBase.prototype.parallelEach = function parallelEach() {
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
    var group = self._asyncGroup();
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
      process.nextTick(group(ContextBase.SIGNAL_UNLOCK));
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
    callback.apply(null, [this.err].concat(this.args));
    this.err = null;
  };
  end.stepName = (fn.stepName || fn.name) + '_end';
  process.nextTick(function execFlow() {
    flow('exec')(fn, end).apply(self, args);
  });
};


function StepContext(flow, step) {
  ContextBase.call(this, flow, step);
}
util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function next() {
  disableContextMethods(this);
  this._flow.err = null;
  this._flow.args = Array.prototype.slice.call(arguments);
  this._step.events.emit('done', this._flow);
};

StepContext.prototype.end = function end() {
  disableContextMethods(this);
  this._flow.err = null;
  this._flow.args = Array.prototype.slice.call(arguments);
  runLastStep(this._flow);
};

StepContext.prototype.endWith = function endWith(err) {
  disableContextMethods(this);
  this._flow.err = err;
  this._flow.args = [];
  runLastStep(this._flow);
};


function LastStepContext(flow) {
  ContextBase.call(this, flow, flow.lastStep);
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
