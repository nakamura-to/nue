var flow = require('../lib/nue').flow;
var assert = require('assert');

describe('flow', function() {
  it('should chain functions with "next"', function (done) {
    flow(
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
        assert.ok(!this.err);
        assert.ok(this.data.a);
        assert.ok(this.data.b);
        assert.ok(this.data.c);
        assert.strictEqual(this.data.acc, 'abc');
        done();
      }
    )();
  });

  it('should chain functions with "async"', function (done) {
    flow(
      function () {
        this.data.a = true;
        this.data.acc = 'a';
        var f = this.async();
        var g = this.async();
        var self = this;
        process.nextTick(function () {
          self.data.b = true;
          f();
        });
        process.nextTick(function () {
          self.data.c = true;
          g();
        });
      },
      function () {
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
        assert.ok(!this.err);
        assert.ok(this.data.a);
        assert.ok(this.data.b);
        assert.ok(this.data.c);
        assert.ok(this.data.d);
        assert.ok(this.data.e);
        assert.ok(this.data.f);
        assert.strictEqual(this.data.acc, 'ad');
        done();
      }
    )();
  });

  it('should exit with no error', function (done) {
    flow(
      function () {
        this.next();
      },
      function () {
        this.end(null, 'aaa', 123);
      },
      function () {
        this.data += 'c';
        this.next();
      },
      function (string, number) {
        assert.ok(!this.err);
        assert.strictEqual(string, 'aaa');
        assert.strictEqual(number, 123);
        done();
      }
    )();
  });

  it('should exit with an error', function (done) {
    flow(
      function () {
        this.next();
      },
      function () {
        this.end('ERROR', 'aaa', 123);
      },
      function () {
        assert.ok(false);
      },
      function (string, number) {
        assert.strictEqual(this.err, 'ERROR');
        this.err = null;
        assert.strictEqual(string, 'aaa');
        assert.strictEqual(number, 123);
        done();
      }
    )();
  });

  it('should exit from an inner flow with an error', function (done) {
    flow(
      function () {
        this.next();
      },
      flow(
        function () {
          this.end('ERROR');
        },function () {
          assert.ok(false);
        },function () {
          assert.strictEqual(this.err, 'ERROR');
          this.err = null;
          this.next();
        }
      ),
      function () {
        this.next();
      },function () {
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

  it('should pass arguments with "next" between functions"', function (done) {
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
        assert.ok(!this.err);
        assert.strictEqual(number, 2);
        assert.strictEqual(bool, false);
        assert.strictEqual(string, 'foo');
        done();
      }
    )();
  });

  it('should pass arguments with "async" between functions"', function (done) {
    flow(
      function () {
        var f = this.async(1, true);
        var g = this.async(2, false);
        setTimeout(function () {
          f(null, 'hoge');
        }, 50);
        setTimeout(function () {
          g(null, 'foo');
        }, 0);
      },
      function (number1, bool1, string1, number2, bool2, string2) {
        assert.ok(!this.err);
        assert.strictEqual(number1, 1);
        assert.strictEqual(bool1, true);
        assert.strictEqual(string1, 'hoge');
        assert.strictEqual(number2, 2);
        assert.strictEqual(bool2, false);
        assert.strictEqual(string2, 'foo');
        done();
      }
    )();
  });

  it('should ignore duplicated "next" calls"', function (done) {
    flow(
      function () {
        this.next(this);
      },
      function (prevContext) {
        assert.ok(!this.err);
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
        assert.strictEqual(argument, 5);
        done();
      }
    )();
  });

  it('should handle empty tasks', function (done) {
    var myFlow = flow();
    flow(
      myFlow,
      function () {
        done();
      }
    )();
  });

  it('should handle single task', function (done) {
    var myFlow = flow(
      function () {
        assert.ok(!this.err);
        this.next();
      }
    );
    flow(
      myFlow,
      function () {
        done();
      }
    )();
  });

  it('should notify an unhandled error', function (done) {
    flow(
      function () {
        this.end(new Error('hoge'));
      },
      function () {
        this.next();
      },
      function () {
        assert.ok(this.err);
        try {
          this.next();
        } catch (e) {
          done();
        }
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
        assert.strictEqual(this.data.hoge, 'aaa');
        done();
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
        assert.ok(!this.err);
        done();
      }
    )();
  });
  
});