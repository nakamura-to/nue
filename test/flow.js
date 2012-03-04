var flow = require('../lib/nue').flow;
var parallel = require('../lib/nue').parallel;
var as = require('../lib/nue').as;
var fs = require('fs');
var assert = require('assert');

describe('flow', function() {
  it('should chain functions with `next`', function (done) {
    flow(
      function () {
        assert.strictEqual(this.flowName, '');
        this.data.a = true;
        this.data.acc = 'a'; 
        this.next();
      },
      function () {
        this.data.b = true;
        this.data.acc += 'b';
        this.next();
      },
      function () {
        this.data.c = true;
        this.data.acc += 'c';
        this.next();
      },
      function () {
        if (this.err) throw this.err;
        assert.ok(this.data.a);
        assert.ok(this.data.b);
        assert.ok(this.data.c);
        assert.strictEqual(this.data.acc, 'abc');
        done();
      }
    )();
  });

  it('should chain functions with `async`', function (done) {
    flow(
      function () {
        this.data.a = true;
        this.data.acc = 'a';
        this.async()();
        this.data.b = true;
        this.data.acc += 'b';
        this.async()();
      },
      function () {
        assert.ok(this.data.a);
        assert.ok(this.data.b);
        this.data.d = true;
        this.data.acc += 'd';
        var f = this.async();
        var g = this.async();
        var self = this;
        process.nextTick(function () {
          self.data.e = true;
          f();
        });
        process.nextTick(function () {
          self.data.f = true;
          g();
        });
      },
      function () {
        if (this.err) throw this.err;
        assert.ok(this.data.a);
        assert.ok(this.data.b);
        assert.ok(this.data.d);
        assert.ok(this.data.e);
        assert.ok(this.data.f);
        assert.strictEqual(this.data.acc, 'abd');
        done();
      }
    )();
  });

  it('should exit without error', function (done) {
    flow(
      function () {
        this.next();
      },
      function () {
        this.end('aaa', 123);
      },
      function () {
        this.data += 'c';
        this.next();
      },
      function (string, number) {
        if (this.err) throw this.err;
        assert.strictEqual(string, 'aaa');
        assert.strictEqual(number, 123);
        done();
      }
    )();
  });

  it('should exit throwing an error', function (done) {
    flow(
      function () {
        this.next();
      },
      function () {
        throw new Error('ERROR');
      },
      function () {
        assert.ok(false);
      },
      function () {
        assert.strictEqual(this.err.message, 'ERROR');
        done();
      }
    )();
  });

  it('should exit using `end`', function (done) {
    flow(
      function () {
        this.next();
      },
      function () {
        this.end(1, 'aaa');
      },
      function () {
        assert.ok(false);
      },
      function (number, string) {
        if (this.err) throw this.err;
        assert.strictEqual(number, 1);
        assert.strictEqual(string, 'aaa');
        done();
      }
    )();
  });

  it('should exit using `endWith`', function (done) {
    flow(
      function () {
        this.next();
      },
      function () {
        this.endWith(new Error('ERROR'));
      },
      function () {
        assert.ok(false);
      },
      function () {
        assert.strictEqual(this.err.message, 'ERROR');
        done();
      }
    )();
  });

  it('should exit from an inner flow using `end`', function (done) {
    flow(
      function () {
        this.next();
      },
      flow(
        function () {
          this.end('hoge');
        },
        function () {
          assert.ok(false);
        },
        function (value) {
          assert.strictEqual(value, 'hoge');
          this.next();
        }
      ),
      function () {
        this.next();
      },
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should exit from an inner flow using `endWith`', function (done) {
    flow(
      function () {
        this.next();
      },
      flow(
        function () {
          this.endWith(new Error('ERROR'));
        },
        function () {
          assert.ok(false);
        },
        function () {
          assert.strictEqual(this.err.message, 'ERROR');
          this.err = null;
          this.next();
        }
      ),
      function () {
        this.next();
      },
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should accept multiple arguments on startup', function (done) {
    flow(
      function (number, bool, string) {
        if (this.err) throw this.err;
        assert.strictEqual(number, 1);
        assert.strictEqual(bool, true);
        assert.strictEqual(string, 'hoge');
        done();
      }
    )(1, true, 'hoge');
  });

  it('should pass arguments using `next` between functions"', function (done) {
    flow(
      function () {
        this.next(1, true, 'hoge');
      },
      function (number, bool, string) {
        assert.strictEqual(number, 1);
        assert.strictEqual(bool, true);
        assert.strictEqual(string, 'hoge');
        this.next(2, false, 'foo');
      },
      function (number, bool, string) {
        if (this.err) throw this.err;
        assert.strictEqual(number, 2);
        assert.strictEqual(bool, false);
        assert.strictEqual(string, 'foo');
        done();
      }
    )();
  });

  it('should pass arguments using `async` between functions"', function (done) {
    flow(
      function () {
        var f = this.async({number: 1, bool: true, result: as(1)});
        var g = this.async({number: 2, bool: false, result: as(1)});
        var x = this.async();
        var y = this.async();
        setTimeout(function () {
          f(null, 'hoge');
        }, 10);
        setTimeout(function () {
          g(null, 'foo');
        }, 0);
        setTimeout(function () {
          x(null, 'bar');
        }, 0);
        setTimeout(function () {
          y(null);
        }, 0);
      },
      function (asyncResult1, asyncResult2, asyncResult3, asyncResult4) {
        if (this.err) throw this.err;
        assert.strictEqual(asyncResult1.number, 1);
        assert.strictEqual(asyncResult1.bool, true);
        assert.strictEqual(asyncResult1.result, 'hoge');
        assert.strictEqual(asyncResult2.number, 2);
        assert.strictEqual(asyncResult2.bool, false);
        assert.strictEqual(asyncResult2.result, 'foo');
        assert.deepEqual(asyncResult3, ['bar']);
        assert.deepEqual(asyncResult4, []);
        done();
      }
    )();
  });

  it('should ignore duplicated `next` calls"', function (done) {
    flow(
      function () {
        this.next(this);
      },
      function (prevContext) {
        if (this.err) throw this.err;
        prevContext.next();
        prevContext.end();
        done();
      }
    )();
  });

  it('should handle sub-flow', function (done) {
    var myFlow = flow(
      function () {
        this.next(1);
      },
      function (i) {
        this.next(i + 1);
      },
      flow(
        function (i) {
          this.next(i + 1);
        },
        function (i) {
          this.next(i + 1);
        }
      ),
      function (i) {
        this.next(i + 1);
      },
      function (i) {
        assert.ok(!this.err);
        this.next(i);
      }
    );
    
    flow(
      myFlow,
      function (argument) {
        if (this.err) throw this.err;
        assert.strictEqual(argument, 5);
        done();
      }
    )();
  });

  it('should handle empty step', function (done) {
    var myFlow = flow();
    flow(
      myFlow,
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should handle single step', function (done) {
    var myFlow = flow(
      function () {
        assert.ok(!this.err);
        this.next();
      }
    );
    flow(
      myFlow,
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should provide flow local data', function (done) {
    flow(
      function () {
        this.data.hoge = 'aaa';
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        if (this.err) throw this.err;
        assert.strictEqual(this.data.hoge, 'aaa');
        done();
      }
    )();
  });

  it('should notify an unhandled error', function (done) {
    flow(
      function () {
        throw new Error('hoge');
      },
      function () {
        this.next();
      },
      function () {
        assert.ok(this.err);
        try {
          this.next();
        } catch (e) {
          assert.strictEqual(e.name, 'NueUnhandledError');
          done();
        }
      }
    )();
  });

  it('should provide flow local data in sub-flow', function (done) {
    flow(
      function () {
        this.data.hoge = 'aaa';
        this.next();
      },
      flow(
        function () {
          this.data.hoge = 'bbb';
          this.next();
        },
        function () {
          assert.strictEqual(this.data.hoge, 'bbb');
          this.next();
        }
      ),
      function () {
        if (this.err) throw this.err;
        assert.strictEqual(this.data.hoge, 'aaa');
        done();
      }
    )();
  });

  it('should handle an error thrown from a step', function (done) {
    flow(
      function () {
        throw new Error('hoge');
      },
      function () {
        this.next();
      },
      function () {
        assert.ok(this.err);
        assert.strictEqual('hoge', this.err.message);
        this.err = null;
        done();
      }
    )();
  });

  it('should handle an error thrown from a function of a nested flow', function (done) {
    flow(
      function () {
        this.next()
      },
      flow(
        function () {
          this.next();
        },
        function () {
          throw new Error('hoge');
        },
        function () {
          this.next();
        }
      ),
      function () {
        assert.ok(this.err);
        assert.strictEqual('hoge', this.err.message);
        this.err = null;
        done();
      }
    )();
  });

  it('should handle an error thrown from a LSAT function of a nested flow', function (done) {
    flow(
      function () {
        this.next()
      },
      flow(
        function () {
          this.next();
        },
        function () {
          this.next();
        },
        function () {
          throw new Error('hoge');
        }
      ),
      function () {
        assert.ok(this.err);
        assert.strictEqual('hoge', this.err.message);
        this.err = null;
        done();
      }
    )();
  });

  it('should handle an error notified with `endWith` from a LSAT function of a nested flow', function (done) {
    flow(
      function () {
        this.next()
      },
      flow(
        function () {
          this.next();
        },
        function () {
          this.next();
        },
        function () {
          this.endWith(new Error('hoge'));
        }
      ),
      function () {
        assert.ok(this.err);
        assert.strictEqual('hoge', this.err.message);
        this.err = null;
        done();
      }
    )();
  });

  it('should handle an error in a nested flow', function (done) {
    flow(
      function () {
        this.next()
      },
      flow(
        function () {
          this.next();
        },
        function () {
          throw new Error('hoge');
        },
        function () {
          if (this.err) {
            this.err = null;
          }
          this.next();
        }
      ),
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should provide context args', function (done) {
    flow(
      function () {
        this.next(1, 'aaa', true);
      },
      function (a, b, c) {
        assert.strictEqual(arguments.length, 3);
        assert.strictEqual(arguments[0], 1);
        assert.strictEqual(arguments[1], 'aaa');
        assert.strictEqual(arguments[2], true);
        this.next(a, b, c);
      },
      function () {
        if (this.err) throw this.err;
        assert.strictEqual(arguments.length, 3);
        assert.strictEqual(arguments[0], 1);
        assert.strictEqual(arguments[1], 'aaa');
        assert.strictEqual(arguments[2], true);
        done();
      }
    )();
  });

  it('should chain functions in an array using `next`', function (done) {
    flow([
      function () {
        this.data.a = true;
        this.data.acc = 'a';
        this.next();
      },
      function () {
        this.data.b = true;
        this.data.acc += 'b';
        this.next();
      },
      function () {
        this.data.c = true;
        this.data.acc += 'c';
        this.next();
      },
      function () {
        if (this.err) throw this.err;
        assert.ok(this.data.a);
        assert.ok(this.data.b);
        assert.ok(this.data.c);
        assert.strictEqual(this.data.acc, 'abc');
        done();
      }
    ])();
  });

  it('should exit with an async error', function (done) {
    flow('myFlow')(
      function step1() {
        this.next();
      },
      function step2() {
        fs.readFile('non-existent-file', 'utf8', this.async());
      },
      function step3() {
        assert.ok(false);
      },
      function step4() {
        assert.strictEqual(this.err.name, 'NueAsyncError');
        assert.strictEqual(this.err.flowName, 'myFlow');
        assert.strictEqual(this.err.stepName, 'step2');
        assert.strictEqual(this.err.stepIndex, 1);
        assert.strictEqual(this.err.asyncIndex, 0);
        assert.ok(this.err.cause);
        done();
      }
    )();
  });

  it('should exit from a last step with an async error', function (done) {
    var myFlow = flow(
      function step1() {
        this.next();
      },
      function step2() {
        fs.readFile('non-existent-file', 'utf8', this.async());
      }
    );

    flow(
      myFlow,
      function () {
        assert.strictEqual(this.err.name, 'NueAsyncError');
        assert.strictEqual(this.err.stepName, 'step2');
        assert.strictEqual(this.err.stepIndex, 1);
        assert.strictEqual(this.err.asyncIndex, 0);
        done();
      }
    )();
  });

  it('should name functions', function (done) {
    flow(
      function step1() {
        assert.strictEqual(this.stepName, 'step1');
        this.next();
      },
      function step2() {
        assert.strictEqual(this.stepName, 'step2');
        process.nextTick(this.async());
      },
      function step3() {
        if (this.err) throw this.err;
        assert.strictEqual(this.stepName, 'step3');
        done();
      }
    )();
  });

  it('should accept name', function (done) {
    flow('myFlow')(
      function step1() {
        assert.strictEqual(this.flowName, 'myFlow');
        assert.strictEqual(this.stepName, 'step1');
        this.next();
      },
      function step2() {
        if (this.err) throw this.err;
        assert.strictEqual(this.flowName, 'myFlow');
        assert.strictEqual(this.stepName, 'step2');
        done();
      }
    )();
  });

  it('should trace step calls', function (done) {
    flow('main')(
      function step1() {
        this.next();
      },
      function step2() {
        this.next();
      },
      flow('sub1')(
        function step1() {
          this.next();
        },
        flow('sub1-1')(
          function step1() {
            this.next();
          }
        ),
        flow('sub1-2')(
          function step1() {
            this.next();
          }
        )
      ),
      flow('sub2')(
        function step1() {
          this.next();
        }
      ),
      function step5() {
        if (this.err) throw this.err;
        assert.strictEqual(this.history.length, 11);
        assert.strictEqual(this.history[0].flowName, 'main');
        assert.strictEqual(this.history[0].stepName, 'step1');
        assert.strictEqual(this.history[0].stepIndex, 0);
        assert.strictEqual(this.history[1].flowName, 'main');
        assert.strictEqual(this.history[1].stepName, 'step2');
        assert.strictEqual(this.history[1].stepIndex, 1);
        assert.strictEqual(this.history[2].flowName, 'main');
        assert.strictEqual(this.history[2].stepName, 'sub1');
        assert.strictEqual(this.history[2].stepIndex, 2);
        assert.strictEqual(this.history[3].flowName, 'sub1');
        assert.strictEqual(this.history[3].stepName, 'step1');
        assert.strictEqual(this.history[3].stepIndex, 0);
        assert.strictEqual(this.history[4].flowName, 'sub1');
        assert.strictEqual(this.history[4].stepName, 'sub1-1');
        assert.strictEqual(this.history[4].stepIndex, 1);
        assert.strictEqual(this.history[5].flowName, 'sub1-1');
        assert.strictEqual(this.history[5].stepName, 'step1');
        assert.strictEqual(this.history[5].stepIndex, 0);
        assert.strictEqual(this.history[6].flowName, 'sub1');
        assert.strictEqual(this.history[6].stepName, 'sub1-2');
        assert.strictEqual(this.history[6].stepIndex, 2);
        assert.strictEqual(this.history[7].flowName, 'sub1-2');
        assert.strictEqual(this.history[7].stepName, 'step1');
        assert.strictEqual(this.history[7].stepIndex, 0);
        assert.strictEqual(this.history[8].flowName, 'main');
        assert.strictEqual(this.history[8].stepName, 'sub2');
        assert.strictEqual(this.history[8].stepIndex, 3);
        assert.strictEqual(this.history[9].flowName, 'sub2');
        assert.strictEqual(this.history[9].stepName, 'step1');
        assert.strictEqual(this.history[9].stepIndex, 0);
        assert.strictEqual(this.history[10].flowName, 'main');
        assert.strictEqual(this.history[10].stepName, 'step5');
        assert.strictEqual(this.history[10].stepIndex, 4);
        done();
      }
    )();
  });

  it('should handle each element of array in default concurrency', function (done) {
    var array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    var indexes = [];
    flow('myFlow')(
      function step1() {
        this.asyncEach(array, function (element, group, i, original) {
          indexes.push(i);
          assert.deepEqual(original, array);
          var callback = group.async(as(0));
          process.nextTick(function () {
            callback(element)
          });
        });
      },
      function step2(results) {
        if (this.err) throw this.err;
        assert.deepEqual(results, array);
        assert.deepEqual(indexes, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
        done();
      }
    )();
  });

  it('should handle each element of array in specified concurrency', function (done) {
    var array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    var indexes = [];
    flow('myFlow')(
      function step1() {
        this.asyncEach(1)(array, function (element, group, i, original) {
          indexes.push(i);
          assert.deepEqual(original, array);
          var callback = group.async();
          process.nextTick(function () {
            callback(null, element)
          });
        });
      },
      function step2(results) {
        if (this.err) throw this.err;
        assert.deepEqual(results, array);
        assert.deepEqual(indexes, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
        done();
      }
    )();
  });

  it('should execute other flows', function (done) {
    var add = flow('add')(
      function addStep(x, y) {
        this.next(x + y);
      }
    );

    var mul = flow('mul')(
      function mulStep(x, y) {
        this.next(x * y);
      }
    );

    flow('main')(
      function parallel() {
        this.exec(add, 10, 20, this.async(as(1)));
        this.exec(mul, 10, 20, this.async(as(1)));
      },
      function end(result1, result2) {
        if (this.err) throw this.err;
        assert.strictEqual(result1, 30);
        assert.strictEqual(result2, 200);
        done();
      }
    )();
  });

  it('should execute other parallels', function (done) {
    var par1 = parallel('par1')(
      function add(x, y) {
        this.next(x + y);
      },
      function sub(x, y) {
        this.next(x - y);
      }
    );

    var par2 = parallel('par2')(
      function mul(x, y) {
        this.next(x * y);
      },
      function div(x, y) {
        this.next(x / y);
      }
    );

    flow('main')(
      function start() {
        this.exec(par1, 10, 20, this.async(as(1)));
        this.exec(par2, 10, 5, this.async(as(1)));
      },
      function end(result1, result2) {
        if (this.err) throw this.err;
        assert.deepEqual(result1, [30, -10]);
        assert.deepEqual(result2, [50, 2]);
        done();
      }
    )();
  });

  it('should execute other functions', function (done) {
    function add(x, y) {
      this.next(x + y);
    }

    function mul(x, y) {
      this.next(x * y);
    }

    flow('main')(
      function parallel() {
        this.exec(add, 10, 20, this.async(as(1)));
        this.exec(mul, 10, 20, this.async(as(1)));
      },
      function end(result1, result2) {
        if (this.err) throw this.err;
        assert.strictEqual(result1, 30);
        assert.strictEqual(result2, 200);
        done();
      }
    )();
  });

  it('should include async 1st arg', function (done) {
    flow('main')(
      function readFile() {
        fs.readFile('non-existent-file', 'utf8', this.async({err: as(0), data: as(1)}));
      },
      function end(result) {
        if (this.err) throw this.err;
        assert.strictEqual(result.err.name, 'Error');
        assert.strictEqual(result.err.errno, 34);
        done();
      }
    )();
  });

  it('should include group 1st arg', function (done) {
    flow('main')(
      function readFile() {
        this.asyncEach(['non-existent-file'], function (file, group) {
          fs.readFile(file, 'utf8', group.async({err: as(0), data: as(1)}));
        });
      },
      function end(results) {
        if (this.err) throw this.err;
        assert.strictEqual(results[0].err.name, 'Error');
        assert.strictEqual(results[0].err.errno, 34);
        done();
      }
    )();
  });
  
  it('should handle an async callback error in asyncEach', function (done) {
    flow('main')(
      function readFile() {
        process.nextTick(this.async());
        this.asyncEach(['non-existent-file'], function (file, group) {
          process.nextTick(group.async());
          process.nextTick(group.async());
          fs.readFile(file, 'utf8', group.async(as(1)));
        });
      },
      function end() {
        assert.strictEqual(this.err.name, 'NueGroupAsyncError');
        assert.strictEqual(this.err.flowName, 'main');
        assert.strictEqual(this.err.stepName, 'readFile');
        assert.strictEqual(this.err.stepIndex, 0);
        assert.strictEqual(this.err.asyncIndex, 1);
        assert.strictEqual(this.err.loopIndex, 0);
        assert.strictEqual(this.err.groupAsyncIndex, 2);
        assert.ok(this.err.cause);
        done();
      }
    )();
    
  });

});