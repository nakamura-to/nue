var nue = module.exports = function(tickSize) {
  tickSize = typeof tickSize === 'number' ? tickSize : nue.tickSize;
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
function SeriesQueue(tickSize, worker, callback) {
  this.tickSize = tickSize;
  this.worker = worker;
  this.callback = callback || noOp;
  this.values = [];
  this.isAddingCompleted = false;
  this.isPushed = false;
};

SeriesQueue.prototype.push = function(value) {
  var self = this;
  function executeBatch (args) {
    var values = self.values.splice(0, self.tickSize);
    if (values.length === 0) {
      return;
    }
    (function execute(value, args) {
      var context;
      if (value === sentinel) {
        self.callback.apply(self, args);
        return;
      }
      context = {
        next: function () {
          var args = Array.prototype.slice.apply(arguments);
          if (values.length) {
            execute(values.shift(), args);
          } else {
            process.nextTick(function () {
              executeBatch(args);
            });
          }
        },
        end: self.callback
      };
      self.worker.apply(context, [value].concat(args));
    }(values.shift(), args));
  }
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
};

SeriesQueue.prototype.complete = function() {
  this.push(sentinel);
  this.isAddingCompleted = true;
};

/**
 * 
 * @param tickSize
 * @param tasks
 * @param callback
 */
function Series(tickSize, tasks, callback) {
  var worker = function(task) {
    var args = Array.prototype.slice.call(arguments, 1);
    task.apply(this, args);
  };
  var queue = new SeriesQueue(tickSize, worker, callback);
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
};

ParallelQueue.prototype.push = function (value) {
  var self = this;
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
      if (value === sentinel) {
        self.isCompleted = true;
        self.callback(null);
        return;
      }
      context = {
        next: noOp,
        end: function () {
          var args = Array.prototype.slice.apply(arguments);
          self.callback.apply(self, args);
          self.callback = noOp;
          self.isCanceled = true;
        }
      };
      self.worker.call(context, value);
    }    
  }
  if (this.isAddingCompleted) {
    throw new Error('This queue has already been frozen.');
  }
  if (this.isCanceled) {
    return;
  }
  this.values.push(value);
  process.nextTick(executeBatch);    
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

Nue.prototype.seriesQueue = function (worker, callback) {
  return new SeriesQueue(this.tickSize, worker, callback);
};

Nue.prototype.series = function (tasks, callback) {
  var args = Array.prototype.slice.apply(arguments);
  if (!Array.isArray(args[0])) {
    tasks = args;
    callback = null;
  }
  var self = this;
  return function () {
    var args = Array.prototype.slice.apply(arguments);
    var first = tasks[0];
    tasks[0] = function () {
      first.apply(this, args);
    };
    return new Series(self.tickSize, tasks, callback);
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
