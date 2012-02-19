'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');


exports.DEFAULT_BATCH_SIZE = 10;
exports.name = 'nue';
exports.version = '0.0.7';
exports.batchSize = exports.DEFAULT_BATCH_SIZE;
exports.flow = flow;


function flow() {
  if (typeof arguments[0] === 'number') {
    var batchSize = arguments[0];
    return function () {
      return flowDefer(batchSize, Array.prototype.slice.call(arguments));
    };
  }
  return flowDefer(null, Array.prototype.slice.call(arguments));
}

function flowDefer(batchSize, tasks) {
  var defer = function () {
    var args = Array.prototype.slice.call(arguments);
    var runner = new FlowRunner(batchSize, tasks, defer, args, this);
    runner.run();
  };
  attachEmitter(defer);
  return defer;
}

function attachEmitter(target) {
  target.events = new EventEmitter();
  target.__nue__ = true;
}

function noop () {}


function FlowRunner(batchSize, tasks, caller, callerArgs, callerContext) {
  this.batchSize = batchSize;
  this.tasks = tasks;
  this.caller = caller;
  this.callerArgs = callerArgs;
  this.callerContext = callerContext;
}

FlowRunner.prototype.endStep = function (emitter, flow) {
  if (flow.batchSize > 0 && flow.batchSize === flow.callCount) {
    flow.callCount = 0;
    process.nextTick(function () {
      emitter.emit('done', flow);
    });
  } else {
    emitter.emit('done', flow);
  }
};

FlowRunner.prototype.startStep = function (context, step, flow) {
  context.invoke(step, flow);
};

FlowRunner.prototype.makeSteps = function () {
  var steps = this.tasks.map(function (task) {
    var fn;
    if (typeof task !== 'function') {
      throw new Error('not function. ' + typeof task);
    }
    if (task.__nue__) {
      return task;
    }
    fn = function () {
      task.apply(this, arguments);
    };
    attachEmitter(fn);
    return fn;
  });
  var len = steps.length - 1;
  var i;
  for (i = 0; i < len; i++) {
    (function (self, i, step, next) {
      if (i < len - 1) {
        step.events.once('done', function(flow) {
          self.startStep(new StepContext(self, next, flow), next, flow);
        });
      } else {
        step.events.once('done', function(flow) {
          self.startStep(new LastStepContext(self, flow), next, flow);
        });
      }
    }(this, i, steps[i], steps[i + 1]));
  }
  if (steps.length === 0) {
    steps.push(function () {
      this.next();
    });
    attachEmitter(steps[0]);
  }
  return steps;
};

FlowRunner.prototype.startFlow = function () {
  var steps = this.makeSteps();
  var firstStep = steps[0];
  var lastStep = steps[steps.length - 1];
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
    lastStep: lastStep,
    batchSize: this.batchSize || exports.batchSize || exports.DEFAULT_BATCH_SIZE,
    callCount: 0
  };
  var context;
  if (firstStep === lastStep) {
    context = new LastStepContext(this, flow)
  } else {
    context = new StepContext(this, firstStep, flow);
  }
  this.startStep(context, firstStep, flow);
};

FlowRunner.prototype.run = function () {
  this.startFlow();
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
  this.batchSize = flow.batchSize;
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
  this.flow.args = Array.prototype.slice.call(arguments, 1);
  this.flow.err = arguments[0];
  this.flow.lastStep.apply(new LastStepContext(this.runner, this.flow), this.flow.args);
};

StepContext.prototype.invoke = function (step, flow) {
  try {
    step.apply(this, flow.args);
  } catch (e) {
    StepContext.prototype.end.call(this, e);
  }
};


function LastStepContext(runner, flow) {
  ContextBase.call(this);
  this.runner = runner;
  this.flow = flow;
  this.batchSize = flow.batchSize;
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

LastStepContext.prototype.invoke = function (step, flow) {
  step.apply(this, flow.args);
};