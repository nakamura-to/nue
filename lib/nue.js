'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');


exports.name = 'nue';
exports.version = '0.0.8';
exports.flow = flow;


function flow() {
  var functions = Array.prototype.slice.call(arguments);
  var deferred = function flowDeferred() {
    var args = Array.prototype.slice.call(arguments);
    var tasks = functions.length > 0 ? functions : function () {this.next();};
    runFlow(tasks, deferred, args, this);
  };
  attachEmitter(deferred);
  return deferred;
}

function runFlow(tasks, caller, callerArgs, callerContext) {
  var flow = {
    args: callerArgs,
    data: {},
    err: undefined,
    lastStep: null,
    isErrThrown: false
  };
  var steps = makeSteps(tasks, caller, callerContext, flow);
  flow.lastStep = steps[steps.length - 1];
  var context = steps.length > 1
    ? new StepContext(steps[0], flow)
    : new LastStepContext(flow);
  context.invoke();
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
          var context = new StepContext(next, flow);
          context.invoke();
        });
      } else {
        step.events.once('done', function runLastStep() {
          var context = new LastStepContext(flow);
          context.invoke();
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
          self.end.apply(self, arguments);
        } else {
          self.results[index] = args.concat(Array.prototype.slice.call(arguments, 1));
          if (self.asyncCallCount === 0) {
            self.next.apply(self, flatten(self.results));
          }
        }
      }
    }
  }(args, this.asyncIndex++));
};


function StepContext(step, flow) {
  ContextBase.call(this);
  this.step = step;
  this.flow = flow;
  this.data = flow.data;
}
util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function next() {
  this.next = noop;
  this.end = noop;
  this.flow.args = Array.prototype.slice.call(arguments);
  this.step.events.emit('done');
};

StepContext.prototype.end = function end(err) {
  this.next = noop;
  this.end = noop;
  this.flow.err = err;
  this.flow.args = Array.prototype.slice.call(arguments, 1);
  var context=  new LastStepContext(this.flow);
  context.invoke();
};

StepContext.prototype.invoke = function invoke() {
  try {
    this.step.apply(this, this.flow.args);
  } catch (e) {
    if (this.flow.isErrThrown) {
      throw e;
    }
    StepContext.prototype.end.call(this, e);
  }
};


function LastStepContext(flow) {
  ContextBase.call(this);
  this.flow = flow;
  this.data = flow.data;
  this.err = flow.err;
}
util.inherits(LastStepContext, ContextBase);

LastStepContext.prototype.next = function next() {
  this.next = noop;
  this.end = noop;
  if (this.err) {
    this.flow.isErrThrown = true;
    throw this.err;
  } else {
    this.flow.isErrThrown = false;    
  }
  this.flow.lastStep.events.emit('done', Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.end = function end(err) {
  this.next = noop;
  this.end = noop;
  if (err) {
    this.flow.isErrThrown = true;
    throw err;
  } else {
    this.flow.isErrThrown = false;
  }
  this.flow.lastStep.events.emit('done', Array.prototype.slice.call(arguments, 1));
};

LastStepContext.prototype.invoke = function invoke() {
  try {
    this.flow.lastStep.apply(this, this.flow.args);
  } catch (e) {
    this.flow.isErrThrown = true;
    throw e;
  }
};