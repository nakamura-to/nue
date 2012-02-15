var EventEmitter = require('events').EventEmitter; 
var util = require('util');

var SENTINEL = {};

var strategies = {
  forEach: function (value, result, i, results, isLast, next) {
    results[i] = result;
    next();
  },
  map: function (value, result, i, results, isLast, next) {
    results[i] = result;
    next();
  },
  filter: function (value, result, i, results, isLast, next) {
    if (result) {
      results.push(value);
    }
    next();
  },
  every: function (value, result, i, results, isLast, next, end) {
    if (!result) {
      end(false);
    } else if (isLast) {
      end(true);
    } else {
      next();
    }
  },
  some: function (value, result, i, results, isLast, next, end) {
    if (result) {
      end(true);
    } else if (isLast) {
      end(false);
    } else {
      next();
    }
  }
};

var runFlow = (function () {

  function StepContext(runner, step, flow) {
    ContextBase.call(this);
    this.runner = runner;
    this.step = step;
    this.flow = flow;
    this.batchSize = flow.batchSize;
    this.err = flow.err;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(StepContext, ContextBase);

  StepContext.prototype.next = function () {
    this.flow.args = Array.prototype.slice.call(arguments);
    this.flow.err = this.err;
    this.runner.endStep(this.step.events, this.flow);
  };

  StepContext.prototype.end = function () {
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
    this.err = flow.err;
    this.next = this.next.bind(this);
  }

  util.inherits(LastStepContext, ContextBase);

  LastStepContext.prototype.next = function () {
    if (this.err) {
      throw new Error('An error is not handled. ' +
        'To avoid this behavior, add the statement. "this.err = null;"\n' +
        'The unhandled error is following:\n' +
        this.err.stack);
    }
    this.flow.args = Array.prototype.slice.call(arguments);
    this.flow.err = this.err;
    this.runner.endStep(this.flow.lastStep.events, this.flow);
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
        emitter.emit('__done__', flow);
      });
    } else {
      emitter.emit('__done__', flow);
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
        throw new Error('not function');
      }
      if (task.__nue__) {
        return task;
      }
      fn = function () {
        return task.apply(this, arguments);
      };
      Nue.attachEmitter(fn);
      return fn;
    });
    var len = steps.length;
    var self = this;
    steps.forEach(function (step, i, steps) {
      var next = steps[i + 1];
      if (i < len - 1) {
        if (step.__nue__) {
          if (i == len - 2 ) {
            step.events.once('__done__', function(flow) {
              self.startStep(new LastStepContext(self, next, flow), next, flow);
            });
          } else {
            step.events.once('__done__', function(flow) {
              self.startStep(new StepContext(self, next, flow), next, flow);
            });
          }
        }
      }
    });
    if (steps.length === 0) {
      steps.push(function () {
        this.next();
      });
      Nue.attachEmitter(steps[0]);
    }
    return steps;
  };

  FlowRunner.prototype.startFlow = function () {
    var inFlow = this.callerContext instanceof ContextBase;
    var steps = this.makeSteps();
    var firstStep = steps[0];
    var lastStep = steps[steps.length - 1];
    var self = this;
    lastStep.events.once('__done__', function (flow) {
      if (inFlow) {
        self.callerContext.next.apply(self.callerContext, flow.args);
      } else {
        self.caller.events.emit('__done__', flow);
      }
    });
    var flow = {
      args: self.callerArgs,
      err: undefined,
      lastStep: lastStep,
      batchSize: this.batchSize || (inFlow && self.callerContext.batchSize) || exports.batchSize,
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

  return function (batchSize, tasks, caller, callerArgs, callerContext) {
    var runner = new FlowRunner(batchSize, tasks, caller, callerArgs, callerContext);
    runner.startFlow();
  };
}());

var runSerial = (function () {

  function SerialContext(runner, value, values) {
    ContextBase.call(this);
    this.runner = runner;
    this.value = value;
    this.values = values;
    this.index = runner.index;
    this.batchSize = runner.batchSize;
    this.isFirst = this.index === 0;
    this.isLast = this.index === runner.lastIndex;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(SerialContext, ContextBase);

  SerialContext.prototype.next = function (result) {
    var values = this.values;
    var runner = this.runner;
    runner.index++;
    runner.strategy(this.value, result, this.index, runner.results, this.isLast,
      function () {
        if (values.length) {
          runner.runWorker(values.shift(), values);
        } else {
          process.nextTick(function () {
            runner.processValues();
          });
        }
      },
      function (result) {
        runner.endSerial(result);
      }
    );
  };

  SerialContext.prototype.end = function (err) {
    this.runner.callerContext.err = err;
    this.runner.endSerial.apply(this.runner, Array.prototype.slice.call(arguments, 1));
  };

  function SerialRunner(batchSize, worker, values, callerContext, strategy) {
    this.batchSize = batchSize || callerContext.batchSize || exports.batchSize;
    if (!this.batchSize) {
      throw new Error('illegal batch size');
    }
    this.worker = worker;
    this.values = values;
    this.callerContext = callerContext;
    this.strategy = strategy;
    this.index = 0;
    this.lastIndex = values.length - 1;
    this.results = [];
  }

  SerialRunner.prototype.endSerial = function () {
    this.callerContext.next.apply(this.callerContext, arguments);
  };

  SerialRunner.prototype.runWorker = function (value, values) {
    this.worker.call(new SerialContext(this, value, values), value);
  };

  SerialRunner.prototype.processValues = function () {
    var batch = this.batchSize > 0 ? this.values.splice(0, this.batchSize) : this.values;
    if (batch.length) {
      this.runWorker(batch.shift(), batch);
    } else {
      this.endSerial(this.results);
    }
  };

  return function (batchSize, worker, values, callerContext, strategy) {
    var runner = new SerialRunner(batchSize, worker, values, callerContext, strategy);
    runner.processValues();
  };
}());

var runParallel = (function () {

  function ParallelContext(runner, value, index) {
    ContextBase.call(this);
    this.runner = runner;
    this.value = value;
    this.index = index;
    this.batchSize = runner.batchSize;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(ParallelContext, ContextBase);

  ParallelContext.prototype.next = function (result) {
    var runner = this.runner;
    runner.workerCount--;
    runner.strategy(this.value, result, this.index, runner.results, runner.workerCount === 0, function () {
    }, function (result) {
      runner.endParallel(result);
    });
  };

  ParallelContext.prototype.end = function () {
    this.runner.callerContext.err = arguments[0];
    this.runner.endParallel.apply(this.runner, Array.prototype.slice.call(arguments, 1));
  };

  function ParallelRunner(batchSize, workers, values, callerContext, strategy) {
    this.batchSize = batchSize || callerContext.batchSize || exports.batchSize;
    if (!this.batchSize) {
      throw new Error('illegal batch size');
    }
    this.workers = workers;
    this.values = values;
    this.callerContext = callerContext;
    this.strategy = strategy;
    this.workerCount = workers.length;
    this.isEnded = false;
    this.results = [];
  }

  ParallelRunner.prototype.endParallel = function () {
    if (!this.isEnded) {
      this.isEnded = true;
      this.callerContext.next.apply(this.callerContext, Array.prototype.slice.apply(arguments));
    }
  };

  ParallelRunner.prototype.processValues = function () {
    var batch;
    var worker;
    var i;
    var len;
    var value;
    var self = this;
    if (this.isEnded) {
      return;
    }
    if (this.workerCount === 0) {
      this.endParallel(this.results);
    } else {
      batch = this.batchSize > 0 ? this.workers.splice(0, this.batchSize) : this.workers;
      len = batch.length;
      for (i = 0; i < len; i++) {
        if (this.isEnded) {
          break;
        }
        worker = batch[i];
        value = this.values[worker.index];
        worker.task.call(new ParallelContext(this, value, worker.index), value);
      }
      process.nextTick(function () {
        self.processValues();
      });
    }
  };

  return function (batchSize, workers, values, callerContext, strategy) {
    var runner = new ParallelRunner(batchSize, workers, values, callerContext, strategy);
    process.nextTick(function () {
      runner.processValues();
    });
  };
}());

function Nue(batchSize) {
  this.batchSize = batchSize;
}

Nue.prototype.flow = function () {
  var tasks = Array.prototype.slice.apply(arguments);
  var batchSize = this.batchSize;
  var fn = function () {
    var args = Array.prototype.slice.apply(arguments);
    runFlow(batchSize, tasks, fn, args, this);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.runSerial = function (worker, strategy) {
  var batchSize = this.batchSize;
  if (typeof worker !== 'function') {
    throw new Error('The worker must be a function.');
  }
  var fn = function () {
    if (!(this instanceof ContextBase)) {
      throw new Error('The context is illegal. This function is out of the flow.');
    }
    runSerial(batchSize, worker, normalizeArguments(arguments), this, strategy);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.forEach = function (worker) {
  return this.runSerial(worker, strategies.forEach);
};

Nue.prototype.map = function (worker) {
  return this.runSerial(worker, strategies.map);
};

Nue.prototype.filter = function (worker) {
  return this.runSerial(worker, strategies.filter);
};

Nue.prototype.every = function (worker) {
  return this.runSerial(worker, strategies.every);
};

Nue.prototype.some = function (worker) {
  return this.runSerial(worker, strategies.some);
};

Nue.prototype.parallel = function () {
  var batchSize = this.batchSize;
  var tasks = normalizeArguments(arguments);
  var workers = tasks.map(function (task, i) {
    return { task: task, index: i };
  });
  var fn = function () {
    if (!(this instanceof ContextBase)) {
      throw new Error('The context is illegal. This function is out of the flow.');
    }
    runParallel(batchSize, workers, normalizeArguments(arguments), this, strategies.map);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.runParallel = function (worker, strategy) {
  if (typeof worker !== 'function') {
    throw new Error('The worker must be a function.');
  }
  var batchSize = this.batchSize;
  var fn = function () {
    if (!(this instanceof ContextBase)) {
      throw new Error('The context is illegal. This function is out of the flow.');
    }
    var values = normalizeArguments(arguments);
    var workers = values.map(function (value, i) {
      return {
        task: function () {
          worker.apply(this, arguments);
        },
        index: i
      };
    });
    runParallel(batchSize, workers, values, this, strategy);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.parallelForEach = function (worker) {
  return this.runParallel(worker, strategies.forEach);
};

Nue.prototype.parallelMap = function (worker) {
  return this.runParallel(worker, strategies.map);
};

Nue.prototype.parallelFilter = function (worker) {
  return this.runParallel(worker, strategies.filter);
};

Nue.prototype.parallelEvery = function (worker) {
  return this.runParallel(worker, strategies.every);
};

Nue.prototype.parallelSome = function (worker) {
  return this.runParallel(worker, strategies.some);
};

Nue.attachEmitter = function (fn) {
  fn.events = new EventEmitter();
  fn.__nue__ = true;
};

function ContextBase() {
  this.async = this.async.bind(this);
  this.queue = this.queue.bind(this);
  this.parallelQueue = this.parallelQueue.bind(this);
}

ContextBase.prototype.async = function () {
  var args = Array.prototype.slice.call(arguments);
  var self = this;
  return function () {
    if (arguments[0]) {
      self.end.apply(self, arguments);
    } else {
      self.next.apply(self, args.concat(Array.prototype.slice.call(arguments, 1)));
    }
  }
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

Queue.prototype.push = (function () {

  function QueueContext(runner, values) {
    ContextBase.call(this);
    this.runner = runner;
    this.values = values;
    this.queue = runner.queue;
    this.index = this.queue.index;
    this.isFirst = this.index === 0;
    this.isLast = this.index === this.queue.isAddingCompleted && this.index === this.queue.length - 1;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(QueueContext, ContextBase);

  QueueContext.prototype.next = function (result) {
    var self = this;
    this.queue.results[this.index] = result;
    this.queue.index++;
    if (this.values.length) {
      this.runner.runWorker(this.values.shift(), this.values);
    } else {
      process.nextTick(function () {
        self.runner.processValues();
      });
    }
  };

  QueueContext.prototype.end = function () {
    this.queue.callerContext.end.apply(this.queue.callerContext, arguments);
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
  
  return function (value) {
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
  }
}());

Queue.prototype.complete = function() {
  this.isAddingCompleted = true;
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
}

ParallelQueue.prototype.push = (function () {

  function ParallelQueueContext(runner, batchSize, index) {
    ContextBase.call(this);
    this.runner = runner;
    this.batchSize = batchSize;
    this.index = index;
    this.queue = runner.queue;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(ParallelQueueContext, ContextBase);

  ParallelQueueContext.prototype.next = function (result) {
    this.queue.results[this.index] = result;
    this.queue.backlog--;
  };

  ParallelQueueContext.prototype.end = function () {
    this.queue.isCanceled = true;
    this.queue.callerContext.end.apply(this.queue.callerContext, arguments);
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
      if (value.value === SENTINEL) {
        process.nextTick(function () {
          self.endParallelQueue(); 
        });
      } else {
        this.runWorker(value);
      }
    }
  };

  return function (value) {
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
    if (!this.runner) {
      this.runner = new ParallelQueueRunner(this);
    }
    process.nextTick(function () {
      self.runner.processValues();
    });
  }
}());

ParallelQueue.prototype.complete = function() {
  this.push(SENTINEL);
  this.isAddingCompleted = true;
};

exports.DEFAULT_BATCH_SIZE = 3;

exports.name = 'nue';

exports.version = '0.0.3';

exports.batchSize = exports.DEFAULT_BATCH_SIZE;

exports.flow = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.flow, args);
};

exports.forEach = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.forEach, args);
};

exports.map = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.map, args);
};

exports.filter = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.filter, args);
};

exports.every = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.every, args);
};

exports.some = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.some, args);
};

exports.queue = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.queue, args);
};

exports.parallel = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallel, args);
};

exports.parallelForEach = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallelForEach, args);
};

exports.parallelMap = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallelMap, args);
};

exports.parallelFilter = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallelFilter, args);
};

exports.parallelEvery = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallelEvery, args);
};

exports.parallelSome = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallelSome, args);
};

exports.parallelQueue = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallelQueue, args);
};

function wrapOrApply (fn, args) {
  if (typeof args[0] === 'number') {
    return function () {
      return fn.apply(new Nue(args[0]), arguments)
    };
  }
  return fn.apply(new Nue(null), args)
}

function normalizeArguments(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0]
  } else {
    return Array.prototype.slice.call(args);
  }
}
