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
        assert.ok(!this.err);
        done();
      }
    )();
  });

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
      function (results) {
        assert.ok(!this.err);
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
        assert.ok(!this.err);
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
        assert.ok(!this.err);
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )();
  });

  it('should exit with an error', function (done) {
    flow(
      parallel(
        function () {
          this.next(1);
        },
        function () {
          this.end('ERROR', ['aaa', 123]);
        },
        function () {
          this.next(3);
        }
      ),
      function (results) {
        assert.strictEqual(this.err, 'ERROR');
        assert.strictEqual(results.length, 2);
        assert.strictEqual(results[0], 'aaa');
        assert.strictEqual(results[1], 123);
        done();
      }
    )();
  });

  it('should exit without an error', function (done) {
    flow(
      parallel(
        function () {
          this.next(1);
        },
        function () {
          this.end(null, ['aaa', 123]);
        },
        function () {
          this.next(3);
        }
      ),
      function (results) {
        assert.ok(!this.err);
        assert.strictEqual(results.length, 2);
        assert.strictEqual(results[0], 'aaa');
        assert.strictEqual(results[1], 123);
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
        assert.ok(!this.err);
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
        assert.ok(!this.err);
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
        assert.ok(!this.err);
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
        assert.ok(!this.err);
        assert.strictEqual(results.length, 3, results);
        assert.strictEqual(results[0], 1);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 3);
        done();
      }
    )();
  });

  it('should work without "end"', function () {
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
    flow(
      myFlow,
      function () {
        done();
      }
    )();
  });

  it('should handle empty array tasks', function (done) {
    var myFlow = flow(
      parallel([])
    );
    flow(
      myFlow,
      function () {
        done();
      }
    )();
  });

  it('should handle single task', function (done) {
    var myFlow = flow(
      parallel(function () {
        this.next();
      })
    );
    flow(
      myFlow,
      function () {
        done();
      }
    )();
  });

  it('should provide flow local data', function (done) {
    flow(
      function () {
        this.data.array = [];
        this.next(1, 2, 3);
      },
      parallel(
        function (i) {
          this.data.array[this.index] = i * 2;
          this.next();
        },
        function (i) {
          this.data.array[this.index] = i * 3;
          this.next();
        },
        function (i) {
          this.data.array[this.index] = i * 4;
          this.next();
        }
      ),
      function () {
        assert.deepEqual(this.data.array, [2, 6, 12]);
        done();
      }
    )();
  });
});