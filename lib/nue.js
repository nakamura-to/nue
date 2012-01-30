var nue = module.exports = function(tickSize) {
  if (typeof tickSize !== 'number' || tickSize < 1) {
    tickSize = nue.tickSize;
  }
  return new Nue(tickSize);
};
var sentinel = {};
var noOp = function () {};

/**
 *
 * @param tickSize
 * @param worker
 * @param callback
 */
function SeriesQueue(tickSize, worker) {
  this.tickSize = tickSize;
  this.worker = worker;
  this.values = [];
  this.isAddingCompleted = false;
  this.isPushed = false;
  this.count = 0;
};

SeriesQueue.prototype.push = function(value) {
  var self = this;
  if (this.isAddingCompleted) {
    throw new Error('This queue has already been frozen.');
  }
  this.values.push(value);
  if (!this.isPushed) {
    this.isPushed = true;
    process.nextTick(function() {
      executeBatch([]);
    });
  }
  function executeBatch (args) {
    var values = self.values.splice(0, self.tickSize);
    if (values.length === 0) {
      return;
    }
    (function execute(value, values, args) {
      var context = {
        index: self.count,
        next: function () {
          var args = Array.prototype.slice.apply(arguments);
          self.count++;
          if (values.length) {
            execute(values.shift(), values, args);
          } else {
            process.nextTick(function () {
              executeBatch(args);
            });
          }
        }
      };
      self.worker.apply(context, [value].concat(args));
    }(values.shift(), values, args));
  }
};

SeriesQueue.prototype.complete = function() {
  this.isAddingCompleted = true;
};

/**
 * 
 * @param tickSize
 * @param tasks
 * @param callback
 */
function Series(tickSize, tasks) {
  var worker = function(task) {
    var args = Array.prototype.slice.call(arguments, 1);
    task.apply(this, args);
  };
  var queue = new SeriesQueue(tickSize, worker);
  tasks.forEach(function (task) {
    queue.push(task);
  });
  queue.complete();
};

/**
 * 
 * @param tickSize
 * @param worker
 * @param callback
 */
function ParallelQueue(tickSize, worker, callback) {
  this.tickSize = tickSize;
  this.worker = worker;
  this.callback = callback || noOp;
  this.values = [];
  this.isAddingCompleted = false;
  this.isCanceled = false;
  this.count = 0;
  this.results = [];
};

ParallelQueue.prototype.push = function (value) {
  if (this.isAddingCompleted) {
    throw new Error('This queue has already been frozen.');
  }
  if (this.isCanceled) {
    return;
  }
  var self = this;
  this.values.push({index : self.count, value: value});
  self.count++;
  process.nextTick(executeBatch);
  function executeBatch() {
    var context;
    var values = self.values;
    var value;
    var i;
    for (i = 0; values.length && i < self.tickSize; i++) {
      if (self.isCanceled) {
        break;
      }
      value = values.shift();
      if (value.value === sentinel) {
        process.nextTick(function end() {
          if (self.count === 1) {
            self.callback.call(null, null, self.results);
            self.count--;
          } else {
            process.nextTick(end);
          }
        });
        return;
      }
      context = {
        index: value.index,
        join: (function(index) {
          return function (result) {
            self.results[index] = result;
            self.count--;
          }
        }(value.index)),
        err: function (e) {
          self.callback.call(null, e, null);
          self.callback = noOp;
          self.isCanceled = true;
        }
      };
      self.worker.call(context, value.value);
    }
  }
};

ParallelQueue.prototype.complete = function() {
  this.push(sentinel);
  this.isAddingCompleted = true;
};

/**
 * 
 * @param tickSize
 * @param tasks
 * @param callback
 */
function Parallel(tickSize, tasks, callback) {
  var worker = function (task) {
    task.call(this);
  };
  var queue = new ParallelQueue(tickSize, worker, callback);
  tasks.forEach(function (task) {
    queue.push(task);
  });
  queue.complete();
};

/**
 * 
 * @param tickSize
 */
function Nue (tickSize) {
  this.tickSize = tickSize;
};

Nue.prototype.seriesQueue = function (worker) {
  return new SeriesQueue(this.tickSize, worker);
};

Nue.prototype.series = function (tasks) {
  var args = Array.prototype.slice.apply(arguments);
  if (!Array.isArray(args[0])) {
    tasks = args;
  }
  var self = this;
  return function () {
    var args = Array.prototype.slice.apply(arguments);
    var first = tasks[0];
    tasks[0] = function () {
      first.apply(this, args);
    };
    return new Series(self.tickSize, tasks);
  };
};

Nue.prototype.parallelQueue = function (worker, callback) {
  return new ParallelQueue(this.tickSize, worker, callback);
};

Nue.prototype.parallel = function (tasks, callback) {
  var args = Array.prototype.slice.apply(arguments);
  if (!Array.isArray(args[0])) {
    tasks = args;
    callback = null;
  }
  var self = this;
  return function () {
    var args = Array.prototype.slice.apply(arguments);
    var wrappers = tasks.map(function (task) {
      return function () {
        task.apply(this, args);
      };
    });
    return new Parallel(self.tickSize, wrappers, callback);
  };
};

nue.DEFAULT_TICK_SIZE = 3;
nue.name = 'nue';
nue.version = '0.0.1';
nue.tickSize = nue.DEFAULT_TICK_SIZE;
nue.seriesQueue = new Nue(nue.tickSize).seriesQueue;
nue.series = new Nue(nue.tickSize).series;
nue.parallelQueue = new Nue(nue.tickSize).parallelQueue;
nue.parallel = new Nue(nue.tickSize).parallel;
