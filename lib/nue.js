'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');


exports.name = 'nue';
exports.version = '0.0.7';
exports.flow = flow;


function flow() {
  var tasks = Array.prototype.slice.call(arguments);
  var deferred = function () {
    var args = Array.prototype.slice.call(arguments);
    var runner = new FlowRunner(tasks, deferred, args, this);
    runner.run();
  };
  attachEmitter(deferred);
  return deferred;
}

function attachEmitter(target) {
  target.events = new EventEmitter();
  target.__nue__ = true;
}

function noop () {}


function FlowRunner(tasks, caller, callerArgs, callerContext) {
  this.tasks = tasks;
  this.caller = caller;
  this.callerArgs = callerArgs;
  this.callerContext = callerContext;
}

FlowRunner.prototype.endStep = function (emitter, flow) {
  emitter.emit('done', flow);
};

FlowRunner.prototype.startStep = function (context) {
  context.invoke();
};

FlowRunner.prototype.makeSteps = function () {
  var steps = this.tasks.map(function (task) {
    var type = typeof task;
    if (type !== 'function') {
      throw new Error('The task is a not function. ' + type);
    }
    if (task.__nue__) {
      return task;
    }
    var deferred = function () {
      task.apply(this, arguments);
    };
    attachEmitter(deferred);
    return deferred;
  });
  var len = steps.length - 1;
  for (var i = 0; i < len; i++) {
    (function (self, i, step, next) {
      var Context = i < len - 1 ? StepContext : LastStepContext;
      step.events.once('done', function (flow) {
        self.startStep(new Context(self, next, flow));
      });
    }(this, i, steps[i], steps[i + 1]));
  }
  if (steps.length === 0) {
    steps.push(function () { this.next(); });
    attachEmitter(steps[0]);
  }
  return steps;
};

FlowRunner.prototype.run = function () {
  var steps = this.makeSteps();
  var firstStep = steps[0];
  var lastStep = steps.pop();
  var self = this;
  lastStep.events.once('done', function (flow) {
    if (self.callerContext instanceof ContextBase) {
      self.callerContext.next.apply(self.callerContext, flow.args);
    } else {
      self.caller.events.emit('done', flow);
    }
  });
  var flow = {
    args: self.callerArgs,
    data: {},
    err: undefined,
    lastStep: lastStep
  };
  var context = firstStep === lastStep 
    ? new LastStepContext(this, lastStep, flow)
    : new StepContext(this, firstStep, flow);
  this.startStep(context);
};


function ContextBase() {
  this.next = this.next.bind(this);
  this.end = this.end.bind(this);
  this.async = this.async.bind(this);
  this.asyncIndex = 0;
  this.asyncCallCount = 0;
  this.isAsyncCanceled = false;
  this.results = [];
}

ContextBase.prototype.async = function () {
  this.asyncCallCount++;
  var args = Array.prototype.slice.call(arguments);
  var self = this;
  return (function (args, index) {
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


function StepContext(runner, step, flow) {
  ContextBase.call(this);
  this.runner = runner;
  this.step = step;
  this.flow = flow;
  this.data = flow.data;
}
util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function () {
  this.next = noop;
  this.end = noop;
  this.flow.args = Array.prototype.slice.call(arguments);
  this.runner.endStep(this.step.events, this.flow);
};

StepContext.prototype.end = function () {
  this.next = noop;
  this.end = noop;
  this.flow.err = arguments[0];
  this.flow.args = Array.prototype.slice.call(arguments, 1);
  var context=  new LastStepContext(this.runner, this.flow.lastStep, this.flow);
  context.invoke();
};

StepContext.prototype.invoke = function () {
  try {
    this.step.apply(this, this.flow.args);
  } catch (e) {
    StepContext.prototype.end.call(this, e);
  }
};


function LastStepContext(runner, step, flow) {
  ContextBase.call(this);
  this.runner = runner;
  this.step = step;
  this.flow = flow;
  this.data = flow.data;
  this.err = flow.err;
}
util.inherits(LastStepContext, ContextBase);

LastStepContext.prototype.next = function () {
  this.next = noop;
  if (this.err) {
    throw new Error('An error is not handled. To avoid this behavior, add the statement "this.err = null;" ' +
      'before exiting the last function. ' +
      'The unhandled error is following:\n' +
      this.err.stack);
  }
  this.flow.args = Array.prototype.slice.call(arguments);
  this.flow.err = this.err;
  this.runner.endStep(this.flow.lastStep.events, this.flow);
};

LastStepContext.prototype.end = function () {
  throw new Error('not supported.');
};

LastStepContext.prototype.invoke = function () {
  this.step.apply(this, this.flow.args);
};