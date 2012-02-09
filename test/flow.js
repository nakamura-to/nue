var nue = require('../lib/nue');
var flow = nue.flow;
var assert = require('assert');

describe('flow', function() {
  it('should chain functions with "next"', function (done) {
    flow(
      function () {
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        assert.ok(!this.err);
        done();
      }
    )();
  });

  it('should chain functions with "async"', function (done) {
    flow(
      function () {
        this.async()();
      },
      function () {
        this.async()();
      },
      function () {
        this.async()();
      },
      function () {
        assert.ok(!this.err);
        done();
      }
    )();
  });

  it('should chain functions with specified batch size', function (done) {
    flow(1)(
      function () {
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        this.next();
      },
      function () {
        assert.ok(!this.err);
        done();
      }
    )();
  });

  it('should exit without an error', function (done) {
    flow(
      function () {
        this.data = 'a';
        this.next();
      },
      function () {
        this.data += 'b';
        this.end(null, 'aaa', 123);
      },
      function () {
        this.data += 'c';
        this.next();
      },
      function (string, number) {
        assert.ok(!this.err);
        assert.strictEqual(this.data, 'ab');
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
        },
        function () {
          assert.ok(false);
        },
        function () {
          assert.strictEqual(this.err, 'ERROR');
          this.err = null;
          this.next();
        }
      ),
      function () {
        this.next();
      },
      function () {
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
        this.async(1, true, 'hoge')();
      },
      function (number, bool, string) {
        assert.strictEqual(number, 1);
        assert.strictEqual(bool, true);
        assert.strictEqual(string, 'hoge');
        this.async(2, false, 'foo')();
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

  it('should ignore duplicated next function calls"', function (done) {
    flow(
      function () {
        this.next(this);
      },
      function (prevContext) {
        assert.ok(!this.err);
        prevContext.next();
        done();
      }
    )();
  });

  it('should share data', function (done) {
    flow(
      function () {
        this.data = 'a'; 
        this.next();
      },
      function () {
        this.data += 'b';
        this.next();
      },
      function () {
        this.data += 'c';
        this.next();
      },
      function () {
        assert.ok(!this.err);
        assert.strictEqual(this.data, 'abc');
        done();
      }
    )();
  });

  it('should emit "done" event', function (done) {
    var myFlow = flow(
      function () {
        this.next(1);
      },
      function (i) {
        this.next(i + 1);
      },
      flow(1)(
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

    myFlow.on('done', function (argument) {
      assert.strictEqual(argument, 5);
      done();
    })();
  });

  it('should handle empty tasks', function (done) {
    var myFlow = flow();
    myFlow.on('done', function() {
      done();
    })();
  });

  it('should handle single task', function (done) {
    var myFlow = flow(
      function () {
        assert.ok(!this.err);
        this.next();
      }
    );
    myFlow.on('done', function() {
      done();
    })();
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

});