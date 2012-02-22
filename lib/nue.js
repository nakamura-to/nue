'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');


exports.name = 'nue';
exports.version = '0.1.0';
exports.flow = flow;


function flow() {
  var functions = normalizeArgs(arguments);
  var deferred = function flowDeferred() {
    var args = Array.prototype.slice.call(arguments);
    var tasks = functions.length > 0 ? functions : function () {this.next();};
    runFlow(tasks, deferred, args, this);
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
  var steps = makeSteps(tasks, caller, callerContext, flow);
  flow.lastStep = steps[steps.length - 1];
  var context = steps.length > 1 ? new StepContext(flow, steps[0]) : new LastStepContext(flow);
  runStep(context);
}

function makeSteps(tasks, caller, callerContext, flow) {
  var steps = tasks.map(function (task) {
    var type = typeof task;
    if (type !== 'function') {
      throw new Error('The task is a not function. ' + type);
    }
    if (task.__nue__) {
      return task;
    }
    var deferred = function stepDeferred() {
      task.apply(this, arguments);
    };
    attachEmitter(deferred);
    return deferred;
  });
  var len = steps.length - 1;
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
    }(i, steps[i], steps[i + 1]));
  }
  steps[steps.length - 1].events.once('done', function exitFlow(args) {
    if (callerContext instanceof ContextBase) {
      // exit from a nested flow and run a next function
      callerContext.next.apply(callerContext, args);
    } else {
      // exit from a top level flow
      caller.events.emit('done', args);
    }
  });
  return steps;
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
      context.flow.lastStep.apply(context, context.args);
    } catch (e) {
      context.flow.isErrThrown = true;
      throw e;
    }
  } else {
    throw new Error('unreachable');
  }
}

function attachEmitter(target) {
  target.events = new EventEmitter();
  target.__nue__ = true;
}

function noop () {}


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
  return (function makeCallback(args, index) {
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
          self.endWithErr.call(self, err);
        } else {
          self.results[index] = args.concat(Array.prototype.slice.call(arguments, 1));
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
  this.args = flow.args;
  this.data = flow.data;
  this.err = flow.err;
}
util.inherits(LastStepContext, ContextBase);

LastStepContext.prototype.next = function next() {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  throwOrExit(this.flow, this.err,  Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.end = function end() {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  throwOrExit(this.flow, this.err,  Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.endWithErr = function endWithErr(err) {
  this.next = noop;
  this.end = noop;
  this.endWithErr = noop;
  throwOrExit(this.flow, err, []);
};

function throwOrExit(flow, err, args) {
  if (err) {
    flow.isErrThrown = true;
    throw err;
  }
  flow.isErrThrown = false;
  flow.lastStep.events.emit('done', args);
}