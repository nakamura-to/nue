var EventEmitter = require('events').EventEmitter; 
var util = require('util');
var sentinel = {};
var noop = function () {};

exports.DEFAULT_BATCH_SIZE = 3;

exports.name = 'nue';

exports.version = '0.0.3';

exports.batchSize = exports.DEFAULT_BATCH_SIZE;

exports.queue = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.queue, args);
};

exports.flow = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.flow, args);
};

exports.each = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.each, args);
};

exports.parallelQueue = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallelQueue, args);
};

exports.parallel = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallel, args);
};

exports.parallelEach = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.parallelEach, args);
};

function wrapOrApply (fn, args) {
  var batchSize = exports.batchSize;
  if (typeof args[0] === 'number') {
    batchSize = args[0];
    return function () {
      return fn.apply(new Nue(batchSize), arguments)
    };
  }
  return fn.apply(new Nue(batchSize), args)
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

Nue.prototype.each = function (worker) {
  var batchSize = this.batchSize;
  if (typeof worker !== 'function') {
    throw new Error('The worker must be a function.');
  }
  var fn = function () {
    var args = Array.prototype.slice.apply(arguments);
    runEach(batchSize, worker, args, this);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.queue = function (worker, end) {
  return new Queue(this.batchSize, worker, end);
};

Nue.prototype.parallel = function () {
  var batchSize = this.batchSize;
  var tasks = arguments.length === 1 && Array.isArray(arguments[0])
    ? arguments[0]
    : Array.prototype.slice.apply(arguments);
   var fn = function () {
    var args = Array.prototype.slice.apply(arguments);
    runParallel(batchSize, tasks, args, this);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.parallelEach = function (worker) {
  var batchSize = this.batchSize;
  if (typeof worker !== 'function') {
    throw new Error('The worker must be a function.');
  }
  var fn = function () {
    var args = Array.prototype.slice.apply(arguments);
    runParallelEach(batchSize, worker, args, this);
  };
  Nue.attachEmitter(fn);
  return fn;
};

Nue.prototype.parallelQueue = function (worker, end) {
  var begin = function () {
    this.fork();
  };
  return new ParallelQueue(this.batchSize, begin, worker, end);
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

function ContextBase() {
}

function runFlow(batchSize, tasks, caller, callerArgs, callerContext) {

  function StepContext(step, flow) {
    this.step = step;
    this.flow = flow;
    this.data = flow.data;
    this.err = flow.err;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
    this.callback = this.callback.bind(this);
  }
  
  util.inherits(StepContext, ContextBase);

  StepContext.prototype.next = function () {
    this.flow.args = Array.prototype.slice.call(arguments);
    this.flow.err = this.err;
    this.flow.data = this.data;
    endStep(this.step.events, this.flow);
  };

  StepContext.prototype.end = function () {
    this.flow.args = Array.prototype.slice.call(arguments, 1);
    this.flow.err = arguments[0];
    this.flow.data = this.data;
    this.flow.lastStep.apply(new LastStepContext(this.step, this.flow), this.flow.args);
  };

  StepContext.prototype.callback = function () {
    if (arguments[0]) {
      this.end.apply(this, arguments);
    } else {
      this.next.apply(this, Array.prototype.slice.call(arguments, 1));
    }
  };

  function LastStepContext(step, flow) {
    this.step = step;
    this.flow = flow;
    this.data = flow.data;
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
    this.flow.data = this.data;
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

  function startStep(step, flow) {
    flow.callCount++;
    step.apply(new StepContext(step, flow), flow.args);
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
          step.events.once('__done__', function(flow) {
            flow.callback.call(null, next, flow);
          });
        }
      }
    });
    return steps;
  }
  
  function startFlow() {
    var steps = makeSteps(tasks);
    var firstStep;
    var lastStep;
    if (steps.length > 0) {
      firstStep = steps[0];
      lastStep = steps[steps.length - 1];
    } else {
      firstStep = function () {
        this.next();
      };
      Nue.attachEmitter(firstStep);
      lastStep = firstStep;
    }
    lastStep.events.once('__done__', function (flow) {
      caller.events.emit('__done__', flow);
      caller.events.emit('done', {data: flow.data}, flow.args);
    });
    startStep(firstStep, {
      args: callerArgs,
      callback: startStep,
      err: undefined,
      data: callerContext instanceof ContextBase ? callerContext.data : {},
      lastStep: lastStep,
      batchSize: batchSize,
      callCount: 0
    });
  }

  startFlow();
}

function runEach(batchSize, worker, callerArgs, callerContext) {
  if (!(callerContext instanceof ContextBase)) {
    throw new Error('The context of the each function is illegal. The function is out of the flow.');
  }

  var index = 0;
  var length = 0;
  var values;
  var results = [];
    
  function EachContext(values, index, data) {
    this.values = values;
    this.index = index;
    this.data = data;
    this.isFirst = index === 0;
    this.isLast = index === length - 1;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
    this.callback = this.callback.bind(this);
  }

  util.inherits(EachContext, ContextBase);

  EachContext.prototype.next = function () {
    var args = Array.prototype.slice.apply(arguments);
    switch (args.length) {
      case 0:  results[index] = undefined; break;
      case 1:  results[index] = args[0]; break;
      default: results[index] = args; break;
    }
    index++;
    callerContext.data = this.data;
    if (this.values.length) {
      runWorker(this.values.shift(), this.values);
    } else {
      process.nextTick(function () {
        processValues();
      });
    }
  };

  EachContext.prototype.end = function () {
    callerContext.err = arguments[0];
    callerContext.data = this.data;
    endEach.apply(null, Array.prototype.slice.call(arguments, 1));
  };

  EachContext.prototype.callback = function () {
    if (arguments[0]) {
      this.end.apply(this, arguments);
    } else {
      this.next.apply(this, Array.prototype.slice.call(arguments, 1));
    }
  };

  function endEach() {
    callerContext.next.apply(callerContext, Array.prototype.slice.apply(arguments));
  }

  function runWorker(value, values) {
    worker.call(new EachContext(values, index, callerContext.data), value);
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

function runParallel(batchSize, tasks, callerArgs, callerContext) {
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

  function ParallelContext(data, index) {
    this.data = data;
    this.index = index;
    this.next = this.next.bind(this);
    this.end = this.end.bind(this);
    this.callback = this.callback.bind(this);
  }

  util.inherits(ParallelContext, ContextBase);

  ParallelContext.prototype.next = function (result) {
    callerContext.data = this.data;
    results[this.index] = result;
    taskCount--;
  };

  ParallelContext.prototype.end = function () {
    callerContext.err = arguments[0];
    callerContext.data = this.data;
    isCanceled = true;
    endParallel.apply(null, Array.prototype.slice.call(arguments, 1));
  };

  ParallelContext.prototype.callback = function (err, result) {
    if (arguments[0]) {
      this.end.apply(this, arguments);
    } else {
      this.next.apply(this, Array.prototype.slice.call(arguments, 1));
    }
  };

  function endParallel() {
    callerContext.next.apply(callerContext, Array.prototype.slice.apply(arguments));
  }

  function processTasks () {
    var tasks;
    var task;
    var i;
    var len;
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
        task.value.call(new ParallelContext(callerContext.data, task.index), parallelArgs[i]);
      }
      process.nextTick(function () {
        processTasks();
      });
    }
  }

  function startParallel() {
    if (callerArgs.length === 1 && Array.isArray(callerArgs[0])) {
      parallelArgs = callerArgs[0]
    } else {
      parallelArgs = callerArgs;
    }
    process.nextTick(function () {
      processTasks();
    });
  }

  startParallel();
}

function runParallelEach(batchSize, worker, callerArgs, callerContext) {
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
      worker.call(this, value);
    }
  });
  runParallel(batchSize, tasks, [], callerContext);
}

/**
 * 
 * @param batchSize
 * @param worker
 * @param end
 */
function Queue(batchSize, worker, end) {
  this.batchSize = batchSize;
  this.worker = worker;
  this.end = end || noop;
  this.values = [];
  this.results = [];
  this.isAddingCompleted = false;
  this.isPushed = false;
  this.length = 0;
  this.index = 0;
  this.data = {};
}

Queue.prototype.push = function(value) {
  var self = this;
  if (this.isAddingCompleted) {
    throw new Error('This queue has been already frozen.');
  }
  this.values.push(value);
  self.length++;
  if (!this.isPushed) {
    this.isPushed = true;
    process.nextTick(function() {
      executeBatch();
    });
  }
  function executeBatch () {
    var values = self.batchSize > 0 ? self.values.splice(0, self.batchSize) : self.values;
    if (values.length === 0) {
      if (self.isAddingCompleted) {
        self.end.call({data: self.data}, null, self.results);
      } else {
        process.nextTick(function () {
          executeBatch();
        });
      }
      return;
    }
    (function execute(value, values) {
      var context = {
        index: self.index,
        isFirst: self.index === 0,
        isLast: self.isAddingCompleted && self.index === self.length - 1,
        data: self.data,
        next: function () {
          var args = Array.prototype.slice.apply(arguments);
          context.next = noop;
          self.data = context.data;
          if (args.length === 0) {
            self.results[self.index] = undefined;
          } else if (args.length === 1) {
            self.results[self.index] = args[0];
          } else {
            self.results[self.index] = args;
          }
          self.index++;
          if (values.length) {
            execute(values.shift(), values);
          } else {
            process.nextTick(function () {
              executeBatch();
            });
          }
        },
        end: function () {
          var end = self.end;
          self.end = noop;
          end.apply({data: context.data}, arguments);
        }
      };
      self.worker.call(context, value);
    }(values.shift(), values));
  }
};

Queue.prototype.complete = function() {
  this.isAddingCompleted = true;
};

/**
 *
 * @param batchSize
 * @param begin
 * @param worker
 * @param end
 */
function ParallelQueue(batchSize, begin, worker, end) {
  this.batchSize = batchSize;
  this.begin = begin;
  this.worker = worker;
  this.end = end || noop;
  this.values = [];
  this.isAddingCompleted = false;
  this.isCanceled = false;
  this.isPushed = false;
  this.length = 0;
  this.taskCount = 0;
  this.results = [];
  this.args = [];
}

ParallelQueue.prototype.push = function (value) {
  var self = this;
  if (this.isAddingCompleted) {
    throw new Error('This queue has been already frozen.');
  }
  if (this.isCanceled) {
    return;
  }
  this.values.push({index : this.length, value: value});
  this.length++;
  this.taskCount++;
  if (!this.isPushed) {
    this.isPushed = true;
    (function () {
      var context = {
        fork: function () {
          self.args = Array.prototype.slice.apply(arguments);
          context.fork = noop;
          process.nextTick(executeBatch);
        }
      };
      self.begin.apply(context);
    }());
  } else {
    process.nextTick(executeBatch);
  }
  function executeBatch() {
    var context;
    var values = self.values;
    var value;
    var i;
    for (i = 0; values.length && (self.batchSize > 0 && i < self.batchSize || self.batchSize < 0); i++) {
      if (self.isCanceled) {
        break;
      }
      value = values.shift();
      if (value.value === sentinel) {
        process.nextTick(function _end() {
          if (self.taskCount === 1) {
            self.end.call(null, null, self.results);
          } else {
            process.nextTick(_end);
          }
        });
        return;
      }
      context = {};
      context.index = value.index;
      context.next = (function(index, context) {
        return function (result) {
          self.results[index] = result;
          self.taskCount--;
          context.next = noop;
        };
      }(value.index, context));
      context.end = function () {
        var args = Array.prototype.slice.apply(arguments);
        self.end.apply(null, args);
        self.end = noop;
        self.isCanceled = true;
      };
      self.worker.call(context, value.value, self.args[value.index]);
    }
  }
};

ParallelQueue.prototype.complete = function() {
  this.push(sentinel);
  this.isAddingCompleted = true;
};
