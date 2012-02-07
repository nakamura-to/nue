var nue = require('../lib/nue');
var flow = nue.flow;
var parallel = nue.parallel;
var assert = require('assert');

describe('parallel', function() {
  it('should chain functions with "next"', function (done) {
    flow(
      function () {
        this.next(1, 2, 3);
      },
      parallel(function () {
        this.next();
      }),
      parallel(function () {
        this.next();
      }),
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should chain functions with "next"', function (done) {
    flow(
      function () {
        this.callback(null, 1, 2, 3);
      },
      parallel(function () {
        this.callback();
      }),
      parallel(function () {
        this.callback();
      }),
      function () {
        if (this.err) throw this.err;
        done();
      }
    )();
  });

  it('should handle multiple tasks', function (done) {
    flow(
      parallel(
        function () {
          this.next(1);
        },
        function () {
          var self = this;
          setTimeout(function () {
            self.next(2);
          }, 10)
        },
        function () {
          this.next(3);
        }
      ),
      function (results) {
        assert.strictEqual(this.err, undefined);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )();
  });

  it('should handle array tasks', function (done) {
    flow(
      parallel(
        [
          function () {
            this.next(1);
          },
          function () {
            var self = this;
            setTimeout(function () {
              self.next(2);
            }, 10)
          },
          function () {
            this.next(3);
          }
        ]
      ),
      function (results) {
        assert.strictEqual(this.err, undefined);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )();
  });

  it('should handle err in the end callback', function (done) {
    flow(
      parallel(
        function () {
          this.next(1);
        },
        function () {
          this.end('ERROR');
        },
        function () {
          this.next(3);
        }
      ),
      function (results) {
        assert.strictEqual(this.err, 'ERROR');
        assert.strictEqual(results, undefined);
        done();
      }
    )();
  });

  it('should accept arguments on startup', function (done) {
    flow(
      parallel(
        function (a) {
          this.next(a);
        },
        function (b) {
          var self = this;
          setTimeout(function () {
            self.next(b);
          }, 10);
        },
        function (c) {
          this.next(c);
        }
      ),
      function (results) {
        assert.strictEqual(this.err, undefined);
        assert.strictEqual(results.length, 3, results);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )(1, 2, 3);
  });

  it('should accept an array argument on startup', function (done) {
    flow(
      parallel(
        function (a) {
          this.next(a);
        },
        function (b) {
          var self = this;
          setTimeout(function () {
            self.next(b);
          }, 10);
        },
        function (c) {
          this.next(c);
        }
      ),
      function (results) {
        assert.strictEqual(this.err, undefined);
        assert.strictEqual(results.length, 3, results);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )([1, 2, 3]);
  });

  it('should accept arguments from the previous function', function (done) {
    flow(
      function () {
        this.next(1, 2, 3);
      },
      parallel(
        function (a) {
          this.next(a);
        },
        function (b) {
          var self = this;
          setTimeout(function () {
            self.next(b);
          }, 10);
        },
        function (c) {
          this.next(c);
        }
      ),
      function (results) {
        assert.strictEqual(this.err, undefined);
        assert.strictEqual(results.length, 3, results);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )();
  });

  it('should accept an array argument from the previous function', function (done) {
    flow(
      function () {
        this.next([1, 2, 3]);
      },
      parallel(
        function (a) {
          this.next(a);
        },
        function (b) {
          var self = this;
          setTimeout(function () {
            self.next(b);
          }, 10);
        },
        function (c) {
          this.next(c);
        }
      ),
      function (results) {
        assert.strictEqual(this.err, undefined);
        assert.strictEqual(results.length, 3, results);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )();
  });

  it('should work without end callback', function () {
    flow(
      parallel(
        function () {
          this.next(null, 1);
        },
        function () {
          this.next(null, 2);
        },
        function () {
          this.next(null, 3);
        }
      )
    )();
  });

  it('should exit from the parallel execution with the end function', function (done) {
    flow(
      parallel(
        function () {
          this.next(1);
        },
        function () {
          this.end('ERROR');
        },
        function () {
          this.next(3);
        }
      ),
      function () {
        assert.strictEqual(this.err, 'ERROR');
        done();
      }
    )();
  });

  it('should handle empty tasks', function (done) {
    var myFlow = flow(
      parallel()
    );
    myFlow.on('done', function() {
      done();
    })();
  });

  it('should handle empty array tasks', function (done) {
    var myFlow = flow(
      parallel([])
    );
    myFlow.on('done', function() {
      done();
    })();
  });

  it('should handle single task', function (done) {
    var myFlow = flow(
      parallel(function () {
        this.next();
      })
    );
    myFlow.on('done', function() {
      done();
    })();
  });
});