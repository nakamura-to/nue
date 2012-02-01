var sentinel = {};
var noOp = function () {};

exports.DEFAULT_BATCH_SIZE = 3;

exports.name = 'nue';

exports.version = '0.0.1';

exports.batchSize = exports.DEFAULT_BATCH_SIZE;

exports.start = function () {
  var args = Array.prototype.slice.apply(arguments);
  var callback;
  if (args.length === 0) {
    return;
  }
  callback = args.pop();
  callback.apply(null, args);
};

exports.serialQueue = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.serialQueue, args);
};

exports.serial = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.serial, args);
};

exports.serialEach = function () {
  var args = Array.prototype.slice.apply(arguments);
  return wrapOrApply(Nue.prototype.serialEach, args);
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
      var args = Array.prototype.slice.apply(arguments);
      return fn.apply(new Nue(batchSize), args)
    };
  }
  return fn.apply(new Nue(batchSize), args)
}

/**
 *
 * @param batchSize
 * @param worker
 */
function SerialQueue(batchSize, worker, end) {
  this.batchSize = batchSize;
  this.worker = worker;
  this.end = end || noOp;
  this.values = [];
  this.isAddingCompleted = false;
  this.isPushed = false;
  this.pushCount = 0;
  this.queueIndex = 0;
  this.data = {};
}

SerialQueue.prototype.push = function(value) {
  var self = this;
  if (this.isAddingCompleted) {
    throw new Error('This queue has already been frozen.');
  }
  this.values.push(value);
  self.pushCount++;
  if (!this.isPushed) {
    this.isPushed = true;
    process.nextTick(function() {
      executeBatch([]);
    });
  }
  function executeBatch (args) {
    var values = self.batchSize > 0 
      ? self.values.splice(0, self.batchSize) 
      : self.values;
    if (values.length === 0) {
      if (self.isAddingCompleted) {
        self.end.apply({data: self.data}, args);
      }
      return;
    }
    (function execute(value, values, args) {
      var context = {
        index: self.queueIndex,
        isFirst: self.queueIndex === 0,
        isLast: self.isAddingCompleted && self.queueIndex === self.pushCount - 1,
        data: self.data,
        next: function () {
          var args = Array.prototype.slice.apply(arguments);
          context.next = noOp;
          self.data = context.data;
          self.queueIndex++;
          if (values.length) {
            execute(values.shift(), values, args);
          } else {
            process.nextTick(function () {
              executeBatch(args);
            });
          }
        },
        end: function () {
          var args = Array.prototype.slice.apply(arguments);
          var end = self.end;
          self.end = noOp;
          end.apply({data: context.data}, args);
        }
      };
      self.worker.apply(context, [value].concat(args));
    }(values.shift(), values, args));
  }
};

SerialQueue.prototype.complete = function() {
  this.isAddingCompleted = true;
};

/**
 * 
 * @param batchSize
 * @param tasks
 */
function Serial(batchSize, tasks, end) {
  var worker = function(task) {
    var args = Array.prototype.slice.call(arguments, 1);
    task.apply(this, args);
  };
  var queue = new SerialQueue(batchSize, worker, end);
  tasks.forEach(function (task) {
    queue.push(task);
  });
  queue.complete();
}

function SerialEach(batchSize, worker, begin, end) {
  var context = {
    data: {},
    each: function () {
      var args = Array.prototype.slice.apply(arguments);
      var values;
      context.each = noOp;
      if (args.length === 0) {
        values = [];
      } else if (args.length === 1) {
        values = Array.isArray(args[0]) ? args[0] : [args[0]];
      } else {
        values = args;
      }
      var queue = new SerialQueue(batchSize, worker, end);
      queue.data = context.data;
      values.forEach(function (value) {
        queue.push(value);
      });
      queue.complete();
    }
  };
  begin.apply(context);
}

/**
 * 
 * @param batchSize
 * @param worker
 * @param begin
 * @param end
 */
function ParallelQueue(batchSize, worker, begin, end) {
  this.batchSize = batchSize;
  this.worker = worker;
  this.begin = begin;
  this.end = end || noOp;
  this.values = [];
  this.isAddingCompleted = false;
  this.isCanceled = false;
  this.isPushed = false;
  this.pushCount = 0;
  this.taskCount = 0;
  this.results = [];
  this.args = [];
}

ParallelQueue.prototype.push = function (value) {
  var self = this;
  if (this.isAddingCompleted) {
    throw new Error('This queue has already been frozen.');
  }
  if (this.isCanceled) {
    return;
  }
  this.values.push({index : this.pushCount, value: value});
  this.pushCount++;
  this.taskCount++;
  if (!this.isPushed) {
    this.isPushed = true;
    (function () {
      var context = {
        fork: function () {
          self.args = Array.prototype.slice.apply(arguments);
          context.fork = noOp;
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
      context.join = (function(index, context) {
        return function (result) {
          self.results[index] = result;
          self.taskCount--;
          context.join = noOp;
        };
      }(value.index, context));
      context.end = function () {
        var args = Array.prototype.slice.apply(arguments);
        self.end.apply(null, args);
        self.end = noOp;
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

/**
 * 
 * @param batchSize
 * @param tasks
 * @param begin
 * @param end
 */
function Parallel(batchSize, tasks, begin, end) {
  var worker = function (task, arg) {
    task.call(this, arg);
  };
  var queue = new ParallelQueue(batchSize, worker, begin, end);
  tasks.forEach(function (task) {
    queue.push(task);
  });
  queue.complete();
}

/**
 * 
 * @param batchSize
 * @param worker
 * @param begin
 * @param end
 */
function ParallelEach(batchSize, worker, begin, end) {
  var context = {
    each: function () {
      var args = Array.prototype.slice.apply(arguments);
      var values;
      context.each = noOp;
      if (args.length === 0) {
        values = [];
      } else if (args.length === 1) {
        values = Array.isArray(args[0]) ? args[0] : [args[0]];
      } else {
        values = args;
      }
      var beginBridge = function () {
        this.fork();
      };
      var queue = new ParallelQueue(batchSize, worker, beginBridge, end);
      values.forEach(function (value) {
        queue.push(value);
      });
      queue.complete();
    }
  };
  begin.apply(context);
} 

/**
 * 
 * @param batchSize
 */
function Nue (batchSize) {
  this.batchSize = batchSize;
}

Nue.prototype.serialQueue = function (worker) {
  return new SerialQueue(this.batchSize, worker);
};

Nue.prototype.serial = function () {
  var tasks = Array.prototype.slice.apply(arguments);
  var self = this;
  return function () {
    var args = Array.prototype.slice.apply(arguments);
    var begin = tasks[0];
    var end;
    tasks[0] = function () {
      begin.apply(this, args);
    };
    if (tasks.length > 1) {
      end = tasks.pop();
    }
    return new Serial(self.batchSize, tasks, end);
  };
};

Nue.prototype.serialEach = function (begin, worker, end) {
  var self = this;
  return function () {
    var args = Array.prototype.slice.apply(arguments);
    var beginWrapper = function () {
      begin.apply(this, args);
    };
    return new SerialEach(self.batchSize, worker, beginWrapper, end);
  };
};

Nue.prototype.parallelQueue = function (worker, end) {
  var begin = function () {
    this.fork();
  };
  return new ParallelQueue(this.batchSize, worker, begin, end);
};

Nue.prototype.parallel = function (begin, tasks, end) {
  var args = Array.prototype.slice.apply(arguments);
  if (Array.isArray(args[0])) {
    begin = function () {
      this.fork();
    };
    tasks = args[0];
    end = typeof args[1] === 'function' ? args[1] : null;
  }
  var self = this;
  return function () {
    var args = Array.prototype.slice.apply(arguments);
    var beginWrapper = function () {
      begin.apply(this, args);
    };
    return new Parallel(self.batchSize, tasks, beginWrapper, end);
  };
};

Nue.prototype.parallelEach = function (begin, worker, end) {
  var self = this;
  return function () {
    var args = Array.prototype.slice.apply(arguments);
    var beginWrapper = function () {
      begin.apply(this, args);
    };
    return new ParallelEach(self.batchSize, worker, beginWrapper, end);
  };
};