'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');


exports.name = 'nue';
exports.version = '0.2.0';
exports.flow = flow;


function flow() {
  if (typeof arguments[0] === 'string') {
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
  var deferred = function startFlow() {
    var args = Array.prototype.slice.call(arguments);
    var steps = functions.length > 0 ? functions : function () { this.next(); };
    runFlow(flowName, steps, deferred, args, this);
  };
  attachEmitter(deferred);
  return deferred;
}

function runFlow(flowName, steps, caller, callerArgs, callerContext) {
  var flow = {
    flowName: flowName,
    args: callerArgs,
    data: {},
    err: null,
    lastStep: null,
    isErrThrown: false
  };
  var deferredSteps = chainSteps(steps, caller, callerContext, flow);
  flow.lastStep = deferredSteps[deferredSteps.length - 1];
  var context = deferredSteps.length > 1 ? new StepContext(flow, deferredSteps[0]) : new LastStepContext(flow);
  runStep(context);
}

function chainSteps(steps, caller, callerContext, flow) {
  var deferredSteps = steps.map(function (step, i) {
    var type = typeof step;
    if (type !== 'function') {
      throw new Error('An argument for a flow is a not function. ' + type);
    }
    var deferred = function applyStep() {
      step.apply(this, arguments);
    };
    deferred.stepName = step.name;
    deferred.stepIndex = i;
    attachEmitter(deferred);
    return deferred;
  });
  var len = deferredSteps.length - 1;
  for (var i = 0; i < len; i++) {
    (function chain(i, step, next) {
      if (i < len - 1) {
        step.events.once('done', function runNextStep() {
          runStep(new StepContext(flow, next));
        });
      } else {
        step.events.once('done', function runLastStep() {
          runStep(new LastStepContext(flow));
        });
      }
    }(i, deferredSteps[i], deferredSteps[i + 1]));
  }
  deferredSteps[deferredSteps.length - 1].events.once('done', function exitFlow(err, args) {
    if (callerContext instanceof ContextBase) {
      // exit from a nested flow and run a next function
      if (err) {
        callerContext.endWith.call(callerContext, err);
      } else {
        callerContext.next.apply(callerContext, args);
      }
    } else {
      // exit from a top level flow
      if (err) {
        flow.isErrThrown = true;
        throw new NueUnhandledError(err);
      }
      caller.events.emit('done', args);
    }
  });
  return deferredSteps;
}

function runStep(context) {
  if (context instanceof StepContext) {
    try {
      context._step.apply(context, context.args);
    } catch (e) {
      if (context._flow.isErrThrown) {
        throw e;
      }
      StepContext.prototype.endWith.call(context, e);
    }
  } else if (context instanceof LastStepContext) {
    try {
      context._step.apply(context, context.args);
    } catch (e) {
      context._flow.isErrThrown = true;
      throw e;
    }
  } else {
    throw new Error('unreachable');
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
  this.message = 'cause = [' + cause + ']: The error must be handled in a last step.';
  Error.captureStackTrace(this, NueUnhandledError);
}
util.inherits(NueUnhandledError, Error);


function ContextBase(flow, step) {
  this._flow = flow;
  this._step = step;
  this._asyncIndex = 0;
  this._asyncCallCount = 0;
  this._isAsyncCanceled = false;
  this._results = [];
  this.err = flow.err;
  this.args = flow.args;
  this.data = flow.data;
  this.flowName = flow.flowName;
  this.stepName = step.stepName;
  this.next = this.next.bind(this);
  this.end = this.end.bind(this);
  this.endWith = this.endWith.bind(this);
  this.async = this.async.bind(this);
}

ContextBase.prototype.async = function async() {
  this._asyncCallCount++;
  var args = Array.prototype.slice.call(arguments);
  var self = this;
  return (function makeCallback(args, asyncIndex) {
    return function (err) {
      self._asyncCallCount--;
      if (!self._isAsyncCanceled) {
        if (err) {
          self._isAsyncCanceled = true;
          self.endWith.call(self, new NueAsyncError(err, self.flowName, self.stepName, self._step.stepIndex, asyncIndex));
        } else {
          self._results[asyncIndex] = args.concat(Array.prototype.slice.call(arguments, 1));
          if (self._asyncCallCount === 0) {
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
    };
  }(args, this._asyncIndex++));
};


function StepContext(flow, step) {
  ContextBase.call(this, flow, step);
}
util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function next() {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
  this._flow.err = null;
  this._flow.args = Array.prototype.slice.call(arguments);
  this._step.events.emit('done');
};

StepContext.prototype.end = function end() {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
  this._flow.err = null;
  this._flow.args = Array.prototype.slice.call(arguments);
  runStep(new LastStepContext(this._flow));
};

StepContext.prototype.endWith = function endWith(err) {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
  this._flow.err = err;
  this._flow.args = [];
  runStep(new LastStepContext(this._flow));
};


function LastStepContext(flow) {
  ContextBase.call(this, flow, flow.lastStep);
}
util.inherits(LastStepContext, ContextBase);

LastStepContext.prototype.next = function next() {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
  this._step.events.emit('done', this.err, Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.end = function end() {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
  this._step.events.emit('done', this.err, Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.endWith = function endWith(err) {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
  this._step.events.emit('done', err, []);
};