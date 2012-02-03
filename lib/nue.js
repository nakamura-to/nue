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
 */
function Nue (batchSize) {
  this.batchSize = batchSize;
}

Nue.prototype.serial = function () {
  var tasks = Array.prototype.slice.apply(arguments);
  var batchSize = this.batchSize;
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
    new Serial(batchSize, tasks, end);
  };
};

Nue.prototype.serialEach = function (begin, worker, end) {
  var batchSize = this.batchSize;
  return function () {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var beginWrapper = function () {
      begin.apply(this, args);
    };
    var endWrapper;
    if (end) {
      endWrapper = function() {
        var args = Array.prototype.slice.apply(arguments);
        end.apply(self, args);
      };
    }
    new SerialEach(batchSize, beginWrapper, worker, endWrapper);
  };
};

Nue.prototype.serialQueue = function (worker, end) {
  return new SerialQueue(this.batchSize, worker, end);
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
  var batchSize = this.batchSize;
  return function () {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var beginWrapper = function () {
      begin.apply(this, args);
    };
    var endWrapper;
    if (end) {
      endWrapper = function() {
        var args = Array.prototype.slice.apply(arguments);
        end.apply(self, args);
      };
    }
    new Parallel(batchSize, beginWrapper, tasks, endWrapper);
  };
};

Nue.prototype.parallelEach = function (begin, worker, end) {
  var batchSize = this.batchSize;
  return function () {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var beginWrapper = function () {
      begin.apply(this, args);
    };
    var endWrapper;
    if (end) {
      endWrapper = function() {
        var args = Array.prototype.slice.apply(arguments);
        end.apply(self, args);
      };
    }
    new ParallelEach(batchSize, beginWrapper, worker, endWrapper);
  };
};

Nue.prototype.parallelQueue = function (worker, end) {
  var begin = function () {
    this.fork();
  };
  return new ParallelQueue(this.batchSize, begin, worker, end);
};

/**
 * 
 * @param batchSize
 * @param tasks
 */
function Serial(batchSize, tasks, end) {
  this.batchSize = batchSize;
  this.tasks = tasks;
  this.end = end;
  this.executeEnd = function (args) {
    var end = self.end;
    self.end = noOp;
    var context = {
      data: self.data,
      next: noOp,
      end: noOp
    };
    end.apply(context, args);
  };
  var self = this;
  (function executeBatch (args) {
    var tasks = self.batchSize > 0 ? self.tasks.splice(0, self.batchSize) : self.tasks;
    if (tasks.length === 0) {
      self.executeEnd(args);
      return;
    }
    (function execute(task, tasks, args) {
      var context = {
        data: self.data,
        next: function () {
          var args = Array.prototype.slice.apply(arguments);
          context.next = noOp;
          self.data = context.data;
          if (tasks.length) {
            execute(tasks.shift(), tasks, args);
          } else {
            process.nextTick(function () {
              executeBatch(args);
            });
          }
        },
        end: function () {
          var args = Array.prototype.slice.apply(arguments);
          self.data = context.data;
          self.executeEnd(args);
        }
      };
      task.apply(context, args);
    }(tasks.shift(), tasks, args));
  }());
}

function SerialEach(batchSize, begin, worker, end) {
  this.batchSize = batchSize;
  this.begin = begin;
  this.worker = worker;
  this.end = end;
  this.index = 0;
  this.length = 0;
  this.data = {};
  this.results = [];
  var self = this;
  var context = {
    data: self.data,
    next: function () {
      var args = Array.prototype.slice.apply(arguments);
      var values;
      context.next = noOp;
      if (args.length === 1 && Array.isArray(args[0])) {
        values = args[0];
      } else {
        values = args;
      }
      self.length = values.length;
      self.data = context.data;
      (function executeBatch () {
        var tasks = self.batchSize > 0 ? values.splice(0, self.batchSize) : values;
        if (tasks.length === 0) {
          self.end.call({data: self.data}, null, self.results);
          return;
        }
        (function execute(task, tasks) {
          var context = {
            isFirst: self.index === 0,
            isLast: self.index === self.length - 1,
            index: self.index,
            data: self.data,
            next: function () {
              var args = Array.prototype.slice.apply(arguments);
              context.next = noOp;
              self.data = context.data;
              if (args.length === 0) {
                self.results[self.index] = undefined;                
              } else if (args.length === 1) {
                self.results[self.index] = args[0];
              } else {
                self.results[self.index] = args;
              }
              self.index++;
              if (tasks.length) {
                execute(tasks.shift(), tasks, args);
              } else {
                process.nextTick(function () {
                  executeBatch();
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
          worker.call(context, task);
        }(tasks.shift(), tasks));
      }());
    }
  };
  begin.apply(context);
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
  this.results = [];
  this.isAddingCompleted = false;
  this.isPushed = false;
  this.length = 0;
  this.index = 0;
  this.data = {};
}

SerialQueue.prototype.push = function(value) {
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
          context.next = noOp;
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
          var args = Array.prototype.slice.apply(arguments);
          var end = self.end;
          self.end = noOp;
          end.apply({data: context.data}, args);
        }
      };
      self.worker.call(context, value);
    }(values.shift(), values));
  }
};

SerialQueue.prototype.complete = function() {
  this.isAddingCompleted = true;
};

/**
 *
 * @param tasks
 * @param batchSize
 * @param begin
 * @param end
 */
function Parallel(batchSize, begin, tasks, end) {
  this.batchSize = batchSize;
  this.begin = begin;
  this.tasks = tasks.map(function (task, i) {
    return { value:task, index:i };
  });
  this.end = end || noOp;
  this.args = [];
  this.results = [];
  this.taskCount = tasks.length;
  this.isCanceled = false;
  var self = this;
  var context = {
    fork: function () {
      var args = Array.prototype.slice.apply(arguments);
      if (args.length === 1 && Array.isArray(args[0])) {
        self.args = args[0]
      } else {
        self.args = args;
      }
      context.fork = noOp;
      process.nextTick(executeBatch);
    }
  };
  self.begin.apply(context);
  function executeBatch () {
    var tasks;
    var task;
    var i;
    var len;
    var context;    
    if (self.taskCount === 0) {
      self.end.call(null, null, self.results);
      return;
    }
    tasks = self.batchSize > 0 ? self.tasks.splice(0, self.batchSize) : self.tasks;
    len = tasks.length;
    for (i = 0; i < len; i++) {
      if (self.isCanceled) {
        break;
      }
      task = tasks[i];
      context = {};
      context.data = self.data;
      context.join = (function(index, context) {
        return function (result) {
          self.results[index] = result;
          self.taskCount--;
          context.join = noOp;
        };
      }(task.index, context));
      context.end = function () {
        var args = Array.prototype.slice.apply(arguments);
        var end = self.end;
        self.end = noOp;
        self.isCanceled = true;
        end.apply(null, args);
      };
      task.value.call(context, self.args[i]);
    }
    process.nextTick(executeBatch);
  }
}

/**
 * 
 * @param batchSize
 * @param worker
 * @param begin
 * @param end
 */
function ParallelEach(batchSize, begin, worker, end) {
  var context = {
    fork: function () {
      var args = Array.prototype.slice.apply(arguments);
      var values;
      var beginBridge;
      var tasks;
      context.fork = noOp;
      if (args.length === 1 && Array.isArray(args[0])) {
        values = args[0];
      } else {
        values = args;
      }
      beginBridge = function () {
        this.fork();
      };
      tasks = values.map(function (value) {
        return function () {
          worker.call(this, value);
        }
      });
      new Parallel(batchSize, beginBridge, tasks, end);
    }
  };
  begin.apply(context);
}

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
  this.end = end || noOp;
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