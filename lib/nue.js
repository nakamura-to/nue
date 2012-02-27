'use strict';

exports.name = 'nue';
exports.version = '0.3.0';
exports.flow = flow;


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
    runFlow(flowName, steps, args, this);
  }
  startFlow.stepName = flowName;
  return startFlow;
}

function runFlow(flowName, steps, callerArgs, callerContext) {
  steps = chainSteps(steps);
  var flow = {
    flowName: flowName,
    args: callerArgs,
    data: {},
    err: null,
    history: callerContext instanceof ContextBase ? callerContext.history : [],
    lastStep: steps[steps.length - 1],
    isErrThrown: false,
    exit: function exit(err, args) {
      if (callerContext instanceof ContextBase) {
        // exit from a nested flow
        if (err) {
          callerContext.endWith.call(callerContext, err);
        } else {
          callerContext.next.apply(callerContext, args);
        }
      } else {
        // exit from a top level flow
        if (err) {
          throw new NueUnhandledError(err);
        }
      }
    }
  };
  if (steps.length > 1) {
    runStep(flow, steps[0]);
  } else {
    runLastStep(flow);
  }
}

function chainSteps(steps) {
  steps = steps.map(function (step, i) {
    assert.equal(typeof step, 'function', 'Each step must be a function.');
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

function attachEmitter(target) {
  if (!target.__nue__) {
    target.events = new EventEmitter();
    target.__nue__ = true;
  }
}

function noop () {}


function NueAsyncError(cause, flowName, stepName, stepIndex, asyncIndex) {
  this.cause = cause;
  this.flowName = flowName;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
  this.asyncIndex = asyncIndex;
  this.name = 'NueAsyncError';
  this.message = 'cause = [' + cause + "], flowName = '" + flowName + "', stepName = '" + stepName +
    "', stepIndex = " + stepIndex + ', asyncIndex = ' + asyncIndex;
  Error.captureStackTrace(this, NueAsyncError);
}
util.inherits(NueAsyncError, Error);


function NueUnhandledError(cause) {
  this.cause = cause;
  this.name = 'NueUnhandledError';
  this.message = 'cause = [' + cause + ']: The error must be handled in a last step. ' +
    'To indicate error handling completion, set null to `this.err`.';
  Error.captureStackTrace(this, NueUnhandledError);
}
util.inherits(NueUnhandledError, Error);


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


function ContextBase(flow, step) {
  this._flow = flow;
  this._step = step;
  this._stepIndex = step.stepIndex;
  this._asyncIndex = 0;
  this._asyncCallCount = 0;
  this._isAsyncCanceled = false;
  this._results = [];
  this._wait = false;
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
  this.forEach = this.forEach.bind(this);
}

ContextBase.ASYNC_COMPLETION_SIGNAL = {};

ContextBase.DEFAULT_CONCURRENCY = 10;

ContextBase.prototype.async = function async() {
  this._asyncCallCount++;
  var args = Array.prototype.slice.call(arguments);
  var self = this;
  return (function makeCallback(args, asyncIndex) {
    function callback(err) {
      self._asyncCallCount--;
      if (!self._isAsyncCanceled) {
        if (err) {
          self._isAsyncCanceled = true;
          self.endWith.call(self, new NueAsyncError(err, self.flowName, self.stepName, self._stepIndex, asyncIndex));
        } else {
          if (args[0] === ContextBase.ASYNC_COMPLETION_SIGNAL) {
            self._wait = false;
          } else {
            self._results[asyncIndex] = args.concat(Array.prototype.slice.call(arguments, 1));
          }
          if (self._asyncCallCount === 0 && !self._wait) {
            self.next.apply(self, self._results.map(function (array) {
              switch(array.length) {
                case 0:  return undefined;
                case 1:  return array[0];
                default: return array;
              }
            }));
          }
        }
      }
    }
    return callback;
  }(args, this._asyncIndex++));
};

ContextBase.prototype.forEach = function forEach() {
  var context = this;
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
    context._wait = true;
    consume(concurrency, array, array.slice(0), worker, 0);
  }

  function consume(concurrency, originalArray, consumedArray, worker, index) {
    var values = consumedArray.splice(0, concurrency);
    var i;
    var len = values.length;
    for (i = 0; i < len; i++) {
      worker.call(context, values[i], i + index, originalArray);
    }
    if (consumedArray.length === 0) {
      process.nextTick(context.async(ContextBase.ASYNC_COMPLETION_SIGNAL));
    } else {
      process.nextTick(function consumeNext() {
        consume(concurrency, originalArray, consumedArray, worker, index + len);
      });
    }
  }
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
  context.async = noop;
  context.end = noop;
  context.endWith = noop;
  context.forEach = noop;
}
