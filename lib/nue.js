'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');


exports.name = 'nue';
exports.version = '0.1.0';
exports.flow = flow;


function flow() {
  var functions = normalizeArgs(arguments);
  var deferred = function startFlow() {
    var args = Array.prototype.slice.call(arguments);
    var steps = functions.length > 0 ? functions : function () { this.next(); };
    runFlow(steps, deferred, args, this);
  };
  attachEmitter(deferred);
  return deferred;
}

function normalizeArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return Array.prototype.slice.call(args);
}

function runFlow(tasks, caller, callerArgs, callerContext) {
  var flow = {
    args: callerArgs,
    data: {},
    err: null,
    lastStep: null,
    isErrThrown: false
  };
  var deferredSteps = chainSteps(tasks, caller, callerContext, flow);
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
        callerContext.endWithErr.call(callerContext, err);
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
      context.step.apply(context, context.args);
    } catch (e) {
      if (context.flow.isErrThrown) {
        throw e;
      }
      StepContext.prototype.endWithErr.call(context, e);
    }
  } else if (context instanceof LastStepContext) {
    try {
      context.step.apply(context, context.args);
    } catch (e) {
      context.flow.isErrThrown = true;
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


function NueAsyncError(cause, stepName, stepIndex, asyncIndex) {
  this.cause = cause;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
  this.asyncIndex = asyncIndex;
  this.name = 'NueAsyncError';
  this.message = 'cause = [' + cause + "], stepName = '" + stepName +
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


function ContextBase() {
  this.next = this.next.bind(this);
  this.end = this.end.bind(this);
  this.async = this.async.bind(this);
  this.asyncIndex = 0;
  this.asyncCallCount = 0;
  this.isAsyncCanceled = false;
  this.results = [];
}

ContextBase.prototype.async = function async() {
  this.asyncCallCount++;
  var args = Array.prototype.slice.call(arguments);
  var self = this;
  return (function makeCallback(args, asyncIndex) {
    function flatten(array) {
      var results = [];
      array.forEach(function (array2) {
        array2.forEach(function (e) {
          results.push(e);
        });
      });
      return results;
    }
    return function (err) {
      self.asyncCallCount--;
      if (!self.isAsyncCanceled) {
        if (err) {
          self.isAsyncCanceled = true;
          self.endWithErr.call(self, new NueAsyncError(err, self.step.stepName, self.step.stepIndex, asyncIndex));
        } else {
          self.results[asyncIndex] = args.concat(Array.prototype.slice.call(arguments, 1));
          if (self.asyncCallCount === 0) {
            self.next.apply(self, flatten(self.results));
          }
        }
      }
    };
  }(args, this.asyncIndex++));
};


function StepContext(flow, step) {
  ContextBase.call(this);
  this.flow = flow;
  this.step = step;
  this.args = flow.args;
  this.data = flow.data;
}
util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function next() {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  this.flow.err = null;
  this.flow.args = Array.prototype.slice.call(arguments);
  this.step.events.emit('done');
};

StepContext.prototype.end = function end() {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  this.flow.err = null;
  this.flow.args = Array.prototype.slice.call(arguments);
  runStep(new LastStepContext(this.flow));
};

StepContext.prototype.endWithErr = function endWithErr(err) {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  this.flow.err = err;
  this.flow.args = [];
  runStep(new LastStepContext(this.flow));
};


function LastStepContext(flow) {
  ContextBase.call(this);
  this.flow = flow;
  this.step = flow.lastStep;
  this.args = flow.args;
  this.data = flow.data;
  this.err = flow.err;
}
util.inherits(LastStepContext, ContextBase);

LastStepContext.prototype.next = function next() {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  this.step.events.emit('done', this.err, Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.end = function end() {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  this.step.events.emit('done', this.err, Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.endWithErr = function endWithErr(err) {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  this.step.events.emit('done', err, []);
};