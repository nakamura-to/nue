'use strict';

// require

var EventEmitter = require('events').EventEmitter;
var util = require('util');


// exports

exports.DEFAULT_BATCH_SIZE = 10;
exports.name = 'nue';
exports.version = '0.0.7';
exports.batchSize = exports.DEFAULT_BATCH_SIZE;
exports.flow = flow;


// variables

var noop = function () {};


// functions

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


// classes

function ContextBase() {
  this.next = this.next.bind(this);
  this.end = this.end.bind(this);
  this.async = this.async.bind(this);
  this.queue = this.queue.bind(this);
  this.parallelQueue = this.parallelQueue.bind(this);
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

ContextBase.prototype.queue = function (worker) {
  var self = this;
  var batchSize = arguments[0];
  if (typeof batchSize === 'number') {
    return function (worker) {
      return new Queue(batchSize, worker, self)
    };
  }
  return new Queue(this.batchSize, worker, self);
};

ContextBase.prototype.parallelQueue = function (worker) {
  var self = this;
  var batchSize = arguments[0];
  if (typeof batchSize === 'number') {
    return function (worker) {
      return new ParallelQueue(batchSize, worker, self)
    };
  }
  return new ParallelQueue(this.batchSize, worker, self);
};


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
  flow.callCount++;
  step.apply(context, flow.args);
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
  var len = steps.length;
  var self = this;
  steps.forEach(function (step, i, steps) {
    var next = steps[i + 1];
    if (i < len - 1) {
      (function (C) {
        step.events.once('done', function(flow) {
          self.startStep(new C(self, next, flow), next, flow);
        });
      }(i < len - 2 ? StepContext : LastStepContext));
    }
  });
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
    context = new LastStepContext(this, firstStep, flow)
  } else {
    context = new StepContext(this, firstStep, flow);
  }
  this.startStep(context, firstStep, flow);
};

FlowRunner.prototype.run = function () {
  this.startFlow();
};


function StepContext(runner, step, flow) {
  ContextBase.call(this);
  this.runner = runner;
  this.step = step;
  this.flow = flow;
  this.batchSize = flow.batchSize;
  this.data = flow.data;
  this.err = flow.err;
}

util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function () {
  this.next = noop;
  this.end = noop;
  this.flow.args = Array.prototype.slice.call(arguments);
  this.flow.err = this.err;
  this.runner.endStep(this.step.events, this.flow);
};

StepContext.prototype.end = function () {
  this.next = noop;
  this.end = noop;
  this.flow.args = Array.prototype.slice.call(arguments, 1);
  this.flow.err = arguments[0];
  this.flow.lastStep.apply(new LastStepContext(this.runner, this.step, this.flow), this.flow.args);
};


function LastStepContext(runner, step, flow) {
  ContextBase.call(this);
  this.runner = runner;
  this.step = step;
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


function Queue(batchSize, worker, callerContext) {
  if (!(callerContext instanceof ContextBase)) {
    throw new Error('The context is illegal. The function is out of the flow.');
  }
  this.batchSize = batchSize;
  this.worker = worker;
  this.callerContext = callerContext;
  this.values = [];
  this.results = [];
  this.isAddingCompleted = false;
  this.length = 0;
  this.index = 0;
}

Queue.prototype.push = function (value) {
  var self = this;
  if (this.isAddingCompleted) {
    throw new Error('This queue has already been frozen.');
  }
  this.values.push(value);
  this.length++;    
  if (!this.runner) {
    this.runner = new QueueRunner(this);
    process.nextTick(function () {
      self.runner.processValues();
    });
  }
};

Queue.prototype.complete = function() {
  this.isAddingCompleted = true;
};


function QueueRunner (queue) {
  this.queue = queue;
}

QueueRunner.prototype.runWorker = function (value, values) {
  this.queue.worker.call(new QueueContext(this, values), value);
};

QueueRunner.prototype.processValues = function () {
  var queue = this.queue;
  var values = queue.batchSize > 0 ? queue.values.splice(0, queue.batchSize) : queue.values;
  var self = this;
  if (values.length === 0) {
    if (queue.isAddingCompleted) {
      queue.callerContext.next.call(queue.callerContext, queue.results);
    } else {
      process.nextTick(function () {
        self.processValues();
      });
    }
  } else {
    self.runWorker(values.shift(), values)
  }
};


function QueueContext(runner, values) {
  ContextBase.call(this);
  this.runner = runner;
  this.values = values;
  this.queue = runner.queue;
  this.data = this.queue.data;
  this.index = this.queue.index;
}

util.inherits(QueueContext, ContextBase);

QueueContext.prototype.next = function (result) {
  this.next = noop;
  this.end = noop;
  this.queue.results[this.index] = result;
  this.queue.index++;
  if (this.values.length) {
    this.runner.runWorker(this.values.shift(), this.values);
  } else {
    var self = this;
    process.nextTick(function () {
      self.runner.processValues();
    });
  }
};

QueueContext.prototype.end = function () {
  this.next = noop;
  this.end = noop;
  this.queue.callerContext.end.apply(this.queue.callerContext, arguments);
};


function ParallelQueue(batchSize, worker, callerContext) {
  if (!(callerContext instanceof ContextBase)) {
    throw new Error('The context is illegal. The function is out of the flow.');
  }
  this.batchSize = batchSize;
  this.worker = worker;
  this.callerContext = callerContext;
  this.values = [];
  this.isAddingCompleted = false;
  this.isCanceled = false;
  this.length = 0;
  this.backlog = 0;
  this.results = [];
  this.runner = new ParallelQueueRunner(this);
}

ParallelQueue.SENTINEL = {};

ParallelQueue.prototype.push = function (value) {
  var self = this;
  if (this.isAddingCompleted) {
    throw new Error('This parallel queue has been already frozen.');
  }
  if (this.isCanceled) {
    return;
  }
  this.values.push({index : this.length, value: value});
  this.length++;
  this.backlog++;
  process.nextTick(function () {
    self.runner.processValues();
  });
};

ParallelQueue.prototype.complete = function() {
  this.push(ParallelQueue.SENTINEL);
  this.isAddingCompleted = true;
};


function ParallelQueueRunner(queue) {
  this.queue = queue;
}

ParallelQueueRunner.prototype.endParallelQueue = function () {
  var self = this;
  if (this.queue.backlog === 1) {
    this.queue.callerContext.next.call(this.queue.callerContext, this.queue.results);
  } else {
    process.nextTick(function () {
      self.endParallelQueue();
    });
  }
};

ParallelQueueRunner.prototype.runWorker = function (value) {
  var context = new ParallelQueueContext(this, this.queue.batchSize, value.index);
  this.queue.worker.call(context, value.value);
};

ParallelQueueRunner.prototype.processValues = function () {
  var value;
  var i;
  var queue = this.queue;
  var self = this;
  for (i = 0; queue.values.length && (queue.batchSize > 0 && i < queue.batchSize || queue.batchSize < 0); i++) {
    if (queue.isCanceled) {
      break;
    }
    value = queue.values.shift();
    if (value.value === ParallelQueue.SENTINEL) {
      process.nextTick(function () {
        self.endParallelQueue();
      });
    } else {
      this.runWorker(value);
    }
  }
};


function ParallelQueueContext(runner, batchSize, index) {
  ContextBase.call(this);
  this.runner = runner;
  this.batchSize = batchSize;
  this.index = index;
  this.queue = runner.queue;
  this.data = this.queue.data;
}

util.inherits(ParallelQueueContext, ContextBase);

ParallelQueueContext.prototype.next = function (result) {
  this.next = noop;
  this.end = noop;
  this.queue.results[this.index] = result;
  this.queue.backlog--;
};

ParallelQueueContext.prototype.end = function () {
  this.next = noop;
  this.end = noop;
  if (!this.queue.isCanceled) {
    this.queue.isCanceled = true;
    this.queue.callerContext.end.apply(this.queue.callerContext, arguments);
  }
};
