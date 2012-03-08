'use strict';

exports.name = 'nue';
exports.version = '0.5.0';
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

    return steps.reduceRight(function chain(prev, curr, index) {
      return function step() {
        var next = index === len - 2 ? last : prev;
        var context = new StepContext(flow, curr.stepName || curr.name, index, next, last);
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
        var context = new StepContext(flow, fn.stepName || fn.name, index, exit, exit);
        try {
          fn.apply(context, arguments);
        } catch (e) {
          isThrown = true;
          throw e;
        }
      }
    }

    function exit() {
      var args = Array.prototype.slice.call(arguments);
      if (flow.isTopLevel) {
        if (flow.err) {
          var message = 'The error must be handled in a last step of its flow. ' +
            'To indicate error handling completed, set null to `this.err` before exiting the last step. ' +
            'cause: ' + util.inspect(flow.err);
          var err = new Error(message);
          err.name = 'NueUnhandledError';
          throw err;
        }
      } else {
        if (flow.err) {
          flow.context.endWith.call(flow.context, flow.err);
        } else {
          flow.context.next.apply(flow.context, args);
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
        var callback = group.async(As.ALL);
        var end = function end() {
          if (this.err) {
            self.endWith(this.err);
            this.err = null;            
          } else {
            callback.apply(null, arguments);
          }
        };
        end.stepName = (fn.stepName || fn.name) + '_end';
        flow(flowName)(fn, end).apply(self, args);
      });
    }
    startParallel.stepName = flowName;
    return startParallel;
  }
}

function as(index) {
  return new As(index);
}

as.val = function val(value) {
  return new As.Val(value);
};

as.all = function all() {
  return As.ALL;
};

as.head = function head() {
  return As.HEAD;
};

as.tail = function tail() {
  return As.TAIL;
};


function normalizeArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return Array.prototype.slice.call(args);
}

function getLocation(target) {
  var originalPrepareStackTrace = Error.prepareStackTrace;
  var originalStackTraceLimit = Error.stackTraceLimit;
  Error.prepareStackTrace = prepareStackTrace;
  Error.stackTraceLimit = 1;
  var err = {};
  Error.captureStackTrace(err, target);
  var stack = err.stack;
  Error.prepareStackTrace = originalPrepareStackTrace;
  Error.stackTraceLimit = originalStackTraceLimit;
  return {
    functionName: stack.getFunctionName(),
    fileName: stack.getFileName(),
    lineNumber: stack.getLineNumber(),
    columnNumber: stack.getColumnNumber()
  };

  function prepareStackTrace(err, structuredStackTrace) {
    return structuredStackTrace[0];
  }
}

function noop () {}


function As(index) {
  this.index = index;
}

As.Val = function Val(value) {
  this.value = value;
};

As.ALL = {description: 'all'};

As.HEAD = {description: 'head'};

As.TAIL = {description: 'tail'};


function Async(lock, next, endWith) {
  this.lock = lock;
  this.next = next;
  this.endWith = endWith;
  this.index = 0;
  this.pending = 0;
  this.isCanceled = false;
  this.results = [];
}

Async.SIGNAL_UNLOCK = {description: 'signal_unlock'};

Async.prototype.makeCallback = function makeCallback(mapping, caller) {
  assert.ok(typeof mapping === 'object' && mapping !== null, 'The argument `mapping` must be an object');
  this.pending++;
  var isFirst = this.index === 0;
  var index = mapping === Async.SIGNAL_UNLOCK ? -1 : this.index++;
  if (isFirst && !this.lock) {
    this.lock = true;
    process.nextTick(this.makeCallback(Async.SIGNAL_UNLOCK));
  }
  var location = getLocation(caller);
  var self = this;
  var asyncCallback = function asyncCallback(cause) {
    self.pending--;
    if (!self.isCanceled) {
      if (isErrorHandleRequired(mapping) && cause) {
        self.isCanceled = true;
        var message = util.format('%s (%s:%d:%d), mapping: %s, cause: %s', 
          location.functionName, location.fileName, location.lineNumber, location.columnNumber, 
          util.inspect(mapping), util.inspect(cause));
        var err = new Error(message);
        err.name = 'NueAsyncError';
        err.cause = cause;
        err.location = location;
        err.mapping = mapping;
        self.endWith.call(null, err);
      } else {
        if (mapping === Async.SIGNAL_UNLOCK) {
          self.lock = false;
        } else {
          self.results[index] = mapArguments(mapping, arguments);
        }
        if (self.pending === 0 && !self.lock) {
          self.next.apply(null, self.results);
        }
      }
    }
  };
  asyncCallback.index = index;
  return asyncCallback;

  function isErrorHandleRequired(mapping) {
    if (mapping === Async.SIGNAL_UNLOCK) {
      return false;
    }
    if (mapping === As.ALL || mapping == As.HEAD) {
      return false;
    }
    if (mapping == As.TAIL) {
      return true;
    }
    if (mapping instanceof As) {
      return mapping.index !== 0;
    }
    if (mapping instanceof As.Val) {
      return false;
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
    if (mapping === As.ALL) {
      return Array.prototype.slice.call(args);
    }
    if (mapping === As.HEAD) {
      return args[0];
    }
    if (mapping === As.TAIL) {
      return Array.prototype.slice.call(args, 1);
    }
    if (mapping instanceof As) {
      return args[mapping.index];
    }
    if (mapping instanceof As.Val) {
      return mapping.value;
    }
    return Object.keys(mapping).reduce(function (result, key) {
      var value = mapping[key];
      if (value instanceof As) {
        result[key] = args[value.index];
      } else if (value instanceof As.Val) {
        result[key] = value.value;
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
  this.history.push({flowName: flow.flowName, stepName: name, stepIndex: index});
  this._asyncObj = new Async(false, this.next.bind(this), this.endWith.bind(this));
}

ContextBase.DEFAULT_CONCURRENCY = 10;

ContextBase.prototype._disable = function _disable() {
  this.next = noop;
  this.end = noop;
  this.endWith = noop;
};

ContextBase.prototype.async = function async(mapping) {
  return this._asyncObj.makeCallback.call(this._asyncObj, mapping, async);
};

ContextBase.prototype.asyncEach = function asyncEach() {
  var self = this;
  var callback = self.async(As.ALL);
  var next = function next() {
    return callback.apply(self, arguments);
  };
  var endWith = function endWith(err) {
    return self.endWith.call(self, err);
  };
  var asyncObj = new Async(true, next, endWith);

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
        var group = {
          async: function async(mapping) {
            return asyncObj.makeCallback.call(asyncObj, mapping, async);
          }
        };
        worker.call(null, array[index], group, index, array);        
      }(index));
    }
    if (index === len) {
      process.nextTick(asyncObj.makeCallback(Async.SIGNAL_UNLOCK));
    } else {
      process.nextTick(function consumeNext() {
        consume(concurrency, array, worker, index);
      });
    }
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
  this._flow.err = this.err;
  this._next.apply(null, arguments);
};

StepContext.prototype.end = function end() {
  this._disable();
  this._flow.err = this.err;
  this._last.apply(null, arguments);
};

StepContext.prototype.endWith = function endWith(err) {
  this._disable();
  this._flow.err = err;
  this._last.call(null);
};
