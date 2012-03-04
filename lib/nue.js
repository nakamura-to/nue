'use strict';

exports.name = 'nue';
exports.version = '0.4.0';
exports.flow = flow;
exports.parallel = parallel;
exports.as = as;


var util = require('util');
var assert = require('assert');


function flow() {
  if (arguments.length === 1 && typeof arguments[0] === 'string') {
    var flowName = arguments[0];
    return function () {
      return prepareFlow(flowName, normalizeArgs(arguments));
    };
  } else {
    return prepareFlow('', normalizeArgs(arguments));
  }

  function prepareFlow(flowName, functions) {
    function startFlow() {
      var isTopLevel = !(this instanceof ContextBase);
      var flow = {
        flowName: flowName,
        context: this,
        isTopLevel: isTopLevel,
        history: isTopLevel ? [] : this.history,
        data: {},
        err: null
      };
      var steps = functions.length > 0 ? functions : [function () { this.next(); }];
      var head = chainSteps(flow, steps);
      head.apply(this, arguments);
    }
    startFlow.stepName = flowName;
    return startFlow;
  }

  function chainSteps(flow, steps) {
    var len = steps.length;
    var lastIndex = len - 1;
    var last = makeLastStep(steps[lastIndex], lastIndex);
    var isThrown = false;
    if (len === 1) {
      return last;
    }

    return steps.reduceRight(function chain(prev, curr, i) {
      return function step() {
        var next = i === len - 2 ? last : prev;
        var context = new StepContext(flow, curr.stepName || curr.name, i, next, last);
        try {
          curr.apply(context, arguments);
        } catch (e) {
          if (isThrown) {
            throw e;
          }
          StepContext.prototype.endWith.call(context, e);
        }
      }
    });

    function makeLastStep(fn, index) {
      return function lastStep() {
        var context = new LastStepContext(flow, fn.stepName || fn.name, index);
        try {
          fn.apply(context, arguments);
        } catch (e) {
          isThrown = true;
          throw e;
        }
      }
    }
  }
}

function parallel() {
  if (arguments.length === 1 && typeof arguments[0] === 'string') {
    var flowName = arguments[0];
    return function () {
      return prepareParallel(flowName, normalizeArgs(arguments));
    };
  } else {
    return prepareParallel('', normalizeArgs(arguments));
  }

  function prepareParallel(flowName, functions) {
    function startParallel() {
      assert.ok(this instanceof ContextBase, 'A `parallel` must be inside a flow or another parallel.');
      var self = this;
      var args = Array.prototype.slice.call(arguments);
      self.asyncEach(1)(functions, function (fn, group) {
        assert.equal(typeof fn, 'function', 'Each argument must be a function.');
        var callback = group.async();
        var end = function end() {
          callback.apply(null, [this.err].concat(Array.prototype.slice.call(arguments)));
          this.err = null;
        };
        end.stepName = (fn.stepName || fn.name) + '_end';
        flow(flowName)(fn, end).apply(self, args);
      });
      process.nextTick(self.async(Async.SIGNAL_UNLOCK));
    }
    startParallel.stepName = flowName;
    return startParallel;
  }
}

function as(index) {
  return new As(index);
}

function normalizeArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return Array.prototype.slice.call(args);
}

function noop () {}


function As(index) {
  this.index = index;
}


function Async(lock, next, endWith) {
  this.lock = lock;
  this.next = next;
  this.endWith = endWith;
  this.index = 0;
  this.pending = 0;
  this.isCanceled = false;
  this.results = [];
}

Async.SIGNAL_UNLOCK = {};

Async.prototype.makeCallback = function makeCallback(mapping, loopIndex, groupAsyncIndex) {
  assert.ok(typeof mapping === 'object' || mapping === undefined, 'The argument `mapping` must be an object if specified.');
  this.pending++;
  var isFirst = this.index === 0;
  var index = mapping === Async.SIGNAL_UNLOCK ? -1 : this.index++;
  if (isFirst && !this.lock) {
    this.lock = true;
    process.nextTick(this.makeCallback(Async.SIGNAL_UNLOCK));
  }
  var self = this;
  var asyncCallback = function asyncCallback(err) {
    self.pending--;
    if (!self.isCanceled) {
      if (isErrorHandleRequire(mapping) && err) {
        self.isCanceled = true;        
        self.endWith.call(null, err, index, mapping, loopIndex, groupAsyncIndex);
      } else {
        if (mapping === Async.SIGNAL_UNLOCK) {
          self.lock = false;
        } else {
          self.results[index] = mapping ? mapArguments(mapping, arguments) : Array.prototype.slice.call(arguments, 1);
        }
        if (self.pending === 0 && !self.lock) {
          self.next.apply(null, self.results);
        }
      }
    }
  };
  asyncCallback.index = index;
  return asyncCallback;

  function isErrorHandleRequire(mapping) {
    if (!mapping) {
      return true;
    }
    if (mapping instanceof As) {
      return mapping.index !== 0;
    }
    return Object.keys(mapping).every(function (key) {
      var value = mapping[key];
      if (value instanceof As) {
        return value.index !== 0;
      } 
      return true;
    });
  }
  
  function mapArguments(mapping, args) {
    if (mapping instanceof As) {
      return args[mapping.index];
    }
    return Object.keys(mapping).reduce(function (result, key) {
      var value = mapping[key];
      if (value instanceof As) {
        result[key] = args[value.index];
      } else {
        result[key] = value;
      }
      return result;
    }, {});
  }
};

function ContextBase(flow, name, index, next, last) {
  this._flow = flow;
  this._next = next;
  this._last = last;
  this.err = flow.err;
  this.data = flow.data;
  this.flowName = flow.flowName;
  this.stepName = name;
  this.stepIndex = index;
  this.history = flow.history;
  this.history.push(new HistoryEntry(flow.flowName, name, index));
  var self = this;
  this._asyncObj = new Async(false, this.next.bind(this), function endWith(err, asyncIndex, mapping) {
    self.endWith.call(self, new NueAsyncError(err, self.flowName, self.stepName, self.stepIndex, asyncIndex, mapping));
  });
}

ContextBase.DEFAULT_CONCURRENCY = 10;

ContextBase.prototype._disable = function _disable() {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
};

ContextBase.prototype.async = function async(mapping) {
  return this._asyncObj.makeCallback.call(this._asyncObj, mapping);
};

ContextBase.prototype.asyncEach = function asyncEach() {
  var self = this;
  var callback = self.async();
  var next = function next() {
    var args = Array.prototype.slice.call(arguments);
    return callback.apply(self, [null].concat(flattenArray(args)));
  };
  var endWith = function endWith(cause, asyncIndex, mapping, loopIndex, asyncGroupIndex) {
    var err = new NueGroupAsyncError(cause, self.flowName, self.stepName, self.stepIndex, callback.index, mapping, loopIndex, asyncGroupIndex);
    return self.endWith.call(self, err);
  };
  var async = new Async(true, next, endWith);

  if (arguments.length === 1 && typeof arguments[0] === 'number') {
    var concurrency = arguments[0];
    return function () {
      validateAndConsume(concurrency, arguments[0], arguments[1]);
    };
  } else {
    validateAndConsume(ContextBase.DEFAULT_CONCURRENCY, arguments[0], arguments[1]);
  }

  function validateAndConsume(concurrency, array, worker) {
    assert.ok(Array.isArray(array), 'An argument `array` must be an array.');
    assert.equal(typeof worker, 'function', 'An argument `worker` must be a function.');
    process.nextTick(function consumeFirst() {
      consume(concurrency, array, worker, 0);
    });
  }

  function consume(concurrency, array, worker, index) {
    var len = array.length;
    for (var i = 0; i < concurrency && index < len; i++, index++) {
      (function callWorker(index) {
        var count = 0;
        var group = {
          async: function (mapping) {
            return async.makeCallback.call(async, mapping, index, count++);
          }
        };
        worker.call(null, array[index], group, index, array);        
      }(index));
    }
    if (index === len) {
      process.nextTick(async.makeCallback(Async.SIGNAL_UNLOCK));
    } else {
      process.nextTick(function consumeNext() {
        consume(concurrency, array, worker, index);
      });
    }
  }
  
  function flattenArray(array) {
    var results = [];
    array.forEach(function (array2) {
      if (Array.isArray(array2)) {
        array2.forEach(function (e) {
          results.push(e);
        });
      } else {
        results.push(array2);
      }
    }); 
    return results;
  }
};

ContextBase.prototype.exec = function exec(fn) {
  assert.ok(arguments.length > 1, 'Arguments length must be more than 1.');
  assert.equal(typeof fn, 'function', 'The first argument must be a function.');
  assert.equal(typeof arguments[arguments.length - 1], 'function', 'The last argument must be a function.');
  var callback = arguments[arguments.length - 1];
  var args = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
  var self = this;
  var end = function end() {
    callback.apply(null, [this.err].concat(Array.prototype.slice.call(arguments)));
    this.err = null;
  };
  end.stepName = (fn.stepName || fn.name) + '_end';
  process.nextTick(function execFlow() {
    flow('exec')(fn, end).apply(self, args);
  });
};


function StepContext(flow, name, index, next, last) {
  ContextBase.call(this, flow, name, index, next, last);
}
util.inherits(StepContext, ContextBase);

StepContext.prototype.next = function next() {
  this._disable();
  this._flow.err = null;
  this._next.apply(null, arguments);
};

StepContext.prototype.end = function end() {
  this._disable();
  this._flow.err = null;
  this._last.apply(null, arguments);
};

StepContext.prototype.endWith = function endWith(err) {
  this._disable();
  this._flow.err = err;
  this._last.call(null);
};


function LastStepContext(flow, name, index) {
  ContextBase.call(this, flow, name, index);
}
util.inherits(LastStepContext, ContextBase);

LastStepContext.prototype.next = function next() {
  this._disable();
  this._exit(Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.end = function end() {
  this._disable();
  this._exit(Array.prototype.slice.call(arguments));
};

LastStepContext.prototype.endWith = function endWith(err) {
  this._disable();
  this.err = err;
  this._exit([]);
};

LastStepContext.prototype._exit = function _exit(args) {
  if (this._flow.isTopLevel) {
    if (this.err) {
      throw new NueUnhandledError(this.err, this.flowName, this.stepName);
    }
  } else {
    if (this.err) {
      this._flow.context.endWith.call(this._flow.context, this.err);
    } else {
      this._flow.context.next.apply(this._flow.context, args);
    }
  }
};

function HistoryEntry(flowName, stepName, stepIndex) {
  this.flowName = flowName;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
}

HistoryEntry.prototype.toString = function toString() {
  var flowName = this.flowName || '<anonymous>';
  var stepName = this.stepName || '<anonymous>';
  return flowName + '[' + this.stepIndex + ']:' + stepName;
};


function NueAsyncError(cause, flowName, stepName, stepIndex, asyncIndex, mapping) {
  this.cause = cause;
  this.flowName = flowName;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
  this.asyncIndex = asyncIndex;
  this.name = 'NueAsyncError';
  this.message = "An error in an async callback:" +
    "\nflowName = '" + flowName + "'," +
    "\nstepName = '" + stepName + "'," +
    '\nstepIndex = ' + stepIndex + ', ' +
    '\nasyncIndex = ' + asyncIndex + ', ' +
    '\nmapping = ' + util.inspect(mapping, false, null) +
    '\n+----- BEGIN CAUSE STACK -----+\n' + indent(cause.stack) + '\n+----- END   CAUSE STACK -----+';
  Error.captureStackTrace(this, NueAsyncError);
}
util.inherits(NueAsyncError, Error);


function NueGroupAsyncError(cause, flowName, stepName, stepIndex, asyncIndex, mapping, loopIndex, groupAsyncIndex) {
  this.cause = cause;
  this.flowName = flowName;
  this.stepName = stepName;
  this.stepIndex = stepIndex;
  this.asyncIndex = asyncIndex;
  this.loopIndex = loopIndex;
  this.groupAsyncIndex = groupAsyncIndex;
  this.name = 'NueGroupAsyncError';
  this.message = "An error in an async callback:" +
    "\nflowName = '" + flowName + "'," +
    "\nstepName = '" + stepName + "'," +
    '\nstepIndex = ' + stepIndex + ', ' +
    '\nasyncIndex = ' + asyncIndex + ', ' +
    '\nloopIndex = ' + loopIndex + ', ' +
    '\ngroupAsyncIndex = ' + groupAsyncIndex + ', ' +
    '\nmapping = ' + util.inspect(mapping, false, null) + 
    '\n+----- BEGIN CAUSE STACK -----+\n' + indent(cause.stack) + '\n+----- END   CAUSE STACK -----+';
  Error.captureStackTrace(this, NueGroupAsyncError);
}
util.inherits(NueGroupAsyncError, Error);


function NueUnhandledError(cause, flowName, stepName) {
  this.cause = cause;
  this.name = 'NueUnhandledError';
  this.message = 'The error must be handled in a last step of flow. ' + 
    'To indicate error handling completed, set null to `this.err` before exiting the last step:' +
    "\nflowName = '" + flowName + "'," +
    "\nstepName = '" + stepName + "'" +
    '\n+----- BEGIN CAUSE STACK -----+\n' + indent(cause.stack) + '\n+----- END   CAUSE STACK -----+';
  Error.captureStackTrace(this, NueUnhandledError);
}
util.inherits(NueUnhandledError, Error);


function indent(text) {
  return '  ' + text.replace(/\n/g, '\n  ');
}