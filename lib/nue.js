var EventEmitter = require('events').EventEmitter; 
var util = require('util');
var sentinel = {};

exports.DEFAULT_BATCH_SIZE = 3;

exports.name = 'nue';

exports.version = '0.0.3';

exports.batchSize = exports.DEFAULT_BATCH_SIZE;

exports.flow = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.flow, args);
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

Nue.prototype.each = function (worker, strategy) {
  var batchSize = this.batchSize;
  if (typeof worker !== 'function') {
    throw new Error('The worker must be a function.');
  }
  var fn = function () {
    var args = Array.prototype.slice.apply(arguments);
    runEach(batchSize, worker, args, this, strategy);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.map = function (worker) {
  return this.each(worker, map);
};

Nue.prototype.filter = function (worker) {
  return this.each(worker, filter);
};

Nue.prototype.every = function (worker) {
  return this.each(worker, every);
};

Nue.prototype.some = function (worker) {
  return this.each(worker, some);
};

Nue.prototype.parallel = function () {
  var batchSize = this.batchSize;
  var tasks = arguments.length === 1 && Array.isArray(arguments[0])
    ? arguments[0]
    : Array.prototype.slice.apply(arguments);
   var fn = function () {
    var args = Array.prototype.slice.apply(arguments);
    runParallel(batchSize, tasks, args, this, map);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.parallelEach = function (worker, strategy) {
  var batchSize = this.batchSize;
  if (typeof worker !== 'function') {
    throw new Error('The worker must be a function.');
  }
  var fn = function () {
    var args = Array.prototype.slice.apply(arguments);
    runParallelEach(batchSize, worker, args, this, strategy);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.parallelMap = function (worker) {
  return this.parallelEach(worker, map);
};

Nue.prototype.parallelFilter = function (worker) {
  return this.parallelEach(worker, filter);
};

Nue.prototype.parallelEvery = function (worker) {
  return this.parallelEach(worker, every);
};

Nue.prototype.parallelSome = function (worker) {
  return this.parallelEach(worker, some);
};

Nue.attachEmitter = function (fn) {
  fn.events = new EventEmitter();
  fn.on = function (type, handler) {
    if (type === 'done') {
      fn.events.on('done', function (context, args) {
        handler.apply(context, args);
      });
    }
    return fn;
  };
  fn.once = function (type, handler) {
    if (type === 'done') {
      fn.events.once('done', function (context, args) {
        handler.apply(context, args);
      });
    }
    return fn;
  };
  fn.__nue__ = true;
};

//noinspection JSUnusedLocalSymbols
function map(value, result, i, results, isLast, next, end) {
  results[i] = result;
  next();
}

//noinspection JSUnusedLocalSymbols
function filter(value, result, i, results, isLast, next, end) {
  if (result) {
    results.push(value);
  }
  next();
}

//noinspection JSUnusedLocalSymbols
function every(value, result, i, results, isLast, next, end) {
  if (!result) {
    end(false);
  } else if (isLast) {
    end(true);
  } else {
    next();
  }
}

//noinspection JSUnusedLocalSymbols
function some(value, result, i, results, isLast, next, end) {
  if (result) {
    end(true);
  } else if (isLast) {
    end(false);
  } else {
    next();
  }
}

function ContextBase() {
  this.queue = this.queue.bind(this);
  this.parallelQueue = this.parallelQueue.bind(this);
  this.async = this.async.bind(this);
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

function runFlow(batchSize, tasks, caller, callerArgs, callerContext) {

  function StepContext(step, flow) {
    ContextBase.call(this);
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
    endStep(this.step.events, this.flow);
  };

  StepContext.prototype.end = function () {
    this.flow.args = Array.prototype.slice.call(arguments, 1);
    this.flow.err = arguments[0];
    this.flow.lastStep.apply(new LastStepContext(this.step, this.flow), this.flow.args);
  };

  function LastStepContext(step, flow) {
    ContextBase.call(this);
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
    endStep(this.flow.lastStep.events, this.flow);
  };

  function endStep(emitter, flow) {
    if (flow.batchSize > 0 && flow.batchSize === flow.callCount) {
      flow.callCount = 0;
      process.nextTick(function () {
        emitter.emit('__done__', flow);
      });
    } else {
      emitter.emit('__done__', flow);
    }
  }

  function startStep(context, step, flow) {
    flow.callCount++;
    step.apply(context, flow.args);
  }

  function makeSteps(tasks) {
    var steps = tasks.map(function (task) {
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
    steps.forEach(function (step, i, steps) {
      var next = steps[i + 1];
      if (i < len - 1) {
        if (step.__nue__) {
          if (i == len - 2 ) {
            step.events.once('__done__', function(flow) {
              startStep(new LastStepContext(next, flow), next, flow);
            });
          } else {
            step.events.once('__done__', function(flow) {
              startStep(new StepContext(next, flow), next, flow);
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
  }
  
  function startFlow(batchSize) {
    var inFlow = callerContext instanceof ContextBase;
    var steps = makeSteps(tasks);
    var firstStep = steps[0];
    var lastStep = steps[steps.length - 1];
    lastStep.events.once('__done__', function (flow) {
      if (callerContext instanceof ContextBase) {
        callerContext.next.apply(callerContext, flow.args);
      } else {
        caller.events.emit('__done__', flow);
      }
      caller.events.emit('done', null, flow.args);
    });
    var flow = {
      args: callerArgs,
      err: undefined,
      lastStep: lastStep,
      batchSize: batchSize || (inFlow && callerContext.batchSize) || exports.batchSize,
      callCount: 0
    };
    var context;
    if (firstStep === lastStep) {
      context = new LastStepContext(firstStep, flow)
    } else {
      context = new StepContext(firstStep, flow);
    }
    startStep(context, firstStep, flow);
  }

  startFlow(batchSize);
}

function runEach(batchSize, worker, callerArgs, callerContext, strategy) {
  if (!(callerContext instanceof ContextBase)) {
    throw new Error('The context of the each function is illegal. The function is out of the flow.');
  }
  
  var index = 0;
  var length = 0;
  var values;
  var results = [];

  batchSize = batchSize || callerContext.batchSize || exports.batchSize;
  if (!batchSize) {
    throw new Error('illegal batch size');
  }

  function EachContext(value, values, index, batchSize) {
    ContextBase.call(this);
    this.value = value;
    this.values = values;
    this.index = index;
    this.batchSize = batchSize;
    this.isFirst = index === 0;
    this.isLast = index === length - 1;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(EachContext, ContextBase);

  EachContext.prototype.next = function (result) {
    var values = this.values;
    index++;
    strategy(this.value, result, this.index, results, this.isLast, function () {
      if (values.length) {
        runWorker(values.shift(), values);
      } else {
        process.nextTick(processValues);
      }
    }, function (result) {
      endEach(result);
    });
  };

  EachContext.prototype.end = function () {
    callerContext.err = arguments[0];
    endEach.apply(null, Array.prototype.slice.call(arguments, 1));
  };

  function endEach() {
    callerContext.next.apply(callerContext, Array.prototype.slice.apply(arguments));
  }

  function runWorker(value, values) {
    worker.call(new EachContext(value, values, index, batchSize), value);
  }

  function processValues() {
    var batch = batchSize > 0 ? values.splice(0, batchSize) : values;
    if (batch.length) {
      runWorker(batch.shift(), batch);
    } else {
      endEach(results);
    }
  }

  function startEach() {
    if (callerArgs.length === 1 && Array.isArray(callerArgs[0])) {
      values = callerArgs[0];
    } else {
      values = callerArgs;
    }
    length = values.length;
    processValues();
  }

  startEach();
}

function runParallel(batchSize, tasks, callerArgs, callerContext, strategy) {
  if (!(callerContext instanceof ContextBase)) {
    throw new Error('The context of the parallel function is illegal. The function is out of the flow.');
  }

  var taskWrappers = tasks.map(function (task, i) {
    return { value:task, index:i };
  });
  var parallelArgs = [];
  var results = [];
  var taskCount = tasks.length;
  var isCanceled = false;

  batchSize = batchSize || callerContext.batchSize || exports.batchSize;
  if (!batchSize) {
    throw new Error('illegal batch size');
  }

  function ParallelContext(batchSize, index) {
    ContextBase.call(this);
    this.batchSize = batchSize;
    this.index = index;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(ParallelContext, ContextBase);

  ParallelContext.prototype.next = function (result) {
    taskCount--;
    strategy(this.value, result, this.index, results, taskCount === 0, function () {
    }, function (result) {
      isCanceled = true;
      endParallel(result);
    });
  };

  ParallelContext.prototype.end = function () {
    callerContext.err = arguments[0];
    isCanceled = true;
    endParallel.apply(null, Array.prototype.slice.call(arguments, 1));
  };

  function endParallel() {
    callerContext.next.apply(callerContext, Array.prototype.slice.apply(arguments));
  }

  function processTasks () {
    var tasks;
    var task;
    var i;
    var len;
    if (isCanceled) {
      return;
    }
    if (taskCount === 0) {
      endParallel(results);
    } else {
      tasks = batchSize > 0 ? taskWrappers.splice(0, batchSize) : taskWrappers;
      len = tasks.length;
      for (i = 0; i < len; i++) {
        if (isCanceled) {
          break;
        }
        task = tasks[i];
        task.value.call(new ParallelContext(batchSize, task.index), parallelArgs[i]);
      }
      process.nextTick(processTasks);
    }
  }

  function startParallel() {
    if (callerArgs.length === 1 && Array.isArray(callerArgs[0])) {
      parallelArgs = callerArgs[0]
    } else {
      parallelArgs = callerArgs;
    }
    process.nextTick(processTasks);
  }

  startParallel();
}

function runParallelEach(batchSize, worker, callerArgs, callerContext, strategy) {
  if (!(callerContext instanceof ContextBase)) {
    throw new Error('The context of the parallelEach function is illegal. The function is out of the flow.');
  }
  var values;
  if (callerArgs.length === 1 && Array.isArray(callerArgs[0])) {
    values = callerArgs[0];
  } else {
    values = callerArgs;
  }
  var tasks = values.map(function (value) {
    return function () {
      // TODO
      this.value = value;
      worker.call(this, value);
    }
  });
  runParallel(batchSize, tasks, [], callerContext, strategy);
}

function Queue(batchSize, worker, callerContext) {
  this.batchSize = batchSize;
  this.worker = worker;
  this.callerContext = callerContext;
  this.values = [];
  this.results = [];
  this.isAddingCompleted = false;
  this.isPushed = false;
  this.length = 0;
  this.index = 0;

  if (!(callerContext instanceof ContextBase)) {
    throw new Error('The context of the queue function is illegal. The function is out of the flow.');
  }
}

Queue.prototype.push = function(value) {
  if (this.isAddingCompleted) {
    throw new Error('This queue has already been frozen.');
  }

  var queue = this;
  queue.values.push(value);
  queue.length++;
  if (!queue.isPushed) {
    queue.isPushed = true;
    process.nextTick(processValues);
  }

  function QueueContext(values, index) {
    ContextBase.call(this);
    this.values = values;
    this.index = index;
    this.isFirst = index === 0;
    this.isLast = index === queue.isAddingCompleted && index === queue.length - 1;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(QueueContext, ContextBase);

  QueueContext.prototype.next = function (result) {
    queue.results[this.index] = result;
    queue.index++;
    if (this.values.length) {
      runWorker(this.values.shift(), this.values);
    } else {
      process.nextTick(processValues);
    }
  };
  
  QueueContext.prototype.end = function () {
    queue.callerContext.end.apply(queue.callerContext, arguments);
  };

  function runWorker(value, values) {
    queue.worker.call(new QueueContext(values, queue.index), value);
  }
    
  function processValues() {
    var values = queue.batchSize > 0 ? queue.values.splice(0, queue.batchSize) : queue.values;
    if (values.length === 0) {
      if (queue.isAddingCompleted) {
        queue.callerContext.next.call(queue.callerContext, queue.results);
      } else {
        process.nextTick(processValues);
      }
    } else {
      runWorker(values.shift(), values)
    }
  }  
};

Queue.prototype.complete = function() {
  this.isAddingCompleted = true;
};

function ParallelQueue(batchSize, worker, callerContext) {
  this.batchSize = batchSize;
  this.worker = worker;
  this.callerContext = callerContext;
  this.values = [];
  this.isAddingCompleted = false;
  this.isCanceled = false;
  this.isPushed = false;
  this.length = 0;
  this.backlog = 0;
  this.results = [];

  if (!(callerContext instanceof ContextBase)) {
    throw new Error('The context of the parallelQueue function is illegal. The function is out of the flow.');
  }
}

ParallelQueue.prototype.push = function (value) {
  if (this.isAddingCompleted) {
    throw new Error('This parallel queue has been already frozen.');
  }
  if (this.isCanceled) {
    return;
  }

  var queue = this;
  queue.values.push({index : this.length, value: value});
  queue.length++;
  queue.backlog++;
  if (!queue.isPushed) {
    queue.isPushed = true;
  }
  process.nextTick(processValues);

  function ParallelQueueContext(batchSize, index) {
    ContextBase.call(this);
    this.batchSize = batchSize;
    this.index = index;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
  }

  util.inherits(ParallelQueueContext, ContextBase);

  ParallelQueueContext.prototype.next = function (result) {
    queue.results[this.index] = result;
    queue.backlog--;
  };

  ParallelQueueContext.prototype.end = function () {
    queue.isCanceled = true;
    queue.callerContext.end.apply(queue.callerContext, arguments);
  };

  function endParallelQueue() {
    if (queue.backlog === 1) {
      queue.callerContext.next.call(queue.callerContext, queue.results);
    } else {
      process.nextTick(endParallelQueue);
    }
  }

  function runWorker(value) {
    var context = new ParallelQueueContext(queue.batchSize, value.index);
    queue.worker.call(context, value.value);
  }

  function processValues() {
    var value;
    var i;
    for (i = 0; queue.values.length && (queue.batchSize > 0 && i < queue.batchSize || queue.batchSize < 0); i++) {
      if (queue.isCanceled) {
        break;
      }
      value = queue.values.shift();
      if (value.value === sentinel) {
        process.nextTick(endParallelQueue);
      } else {
        runWorker(value);
      }
    }
  }
};

ParallelQueue.prototype.complete = function() {
  this.push(sentinel);
  this.isAddingCompleted = true;
};
