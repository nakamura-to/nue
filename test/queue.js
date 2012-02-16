var nue = require('../lib/nue');
var flow = nue.flow;
var map = nue.map;
var parallel = nue.parallel;
var parallelMap = nue.parallelMap;
var assert = require('assert');

describe('queue', function() {
  // FLOW
  describe('flow', function () {
    it('should chain with "next"', function (done) {
      flow(
        function () {
          var q = this.queue(function (i) {
            this.next(i * 2);
          });
          for (var i = 0; i < 10; i++) {
            q.push(i);
          }
          q.complete();
        },
        function (results) {
          assert.ok(!this.err);
          assert.deepEqual(results, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
          done();
        }
      )();
    });

    it('should chain with "async"', function (done) {
      flow(
        function () {
          var q = this.queue(function (i) {
            this.async(i * 2)();
          });
          for (var i = 0; i < 10; i++) {
            q.push(i);
          }
          q.complete();
        },
        function (results) {
          assert.ok(!this.err);
          assert.deepEqual(results, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
          done();
        }
      )();
    });

    it('should exit with "end" in "flow"', function (done) {
      flow(
        function () {
          var q = this.queue(function (i) {
            this.end('ERROR');
          });
          for (var i = 0; i < 10; i++) {
            q.push(i);
          }
          q.complete();
        },
        function () {
          assert.ok(false);
        },
        function (results) {
          assert.strictEqual(this.err, 'ERROR');
          assert.ok(!results);
          done();
        }
      )();
    });

    it('should exit with "async"', function (done) {
      flow(
        function () {
          var q = this.queue(function (i) {
            this.async()('ERROR');
          });
          for (var i = 0; i < 10; i++) {
            q.push(i);
          }
          q.complete();
        },
        function () {
          assert.ok(false);
        },
        function (results) {
          assert.strictEqual(this.err, 'ERROR');
          assert.ok(!results);
          done();
        }
      )();
    });
  });

  // EACH
  describe('map', function () {
    it('should chain with "next"', function (done) {
      flow(
        map(function (len) {
          var q = this.queue(function (i) {
            this.next(i * 2);
          });
          for (var i = 0; i < len; i++) {
            q.push(i);
          }
          q.complete();
        }),
        function (results) {
          assert.ok(!this.err);
          assert.deepEqual(results, [ [ 0 ], [ 0, 2 ], [ 0, 2, 4 ] ]);
          done();
        }
      )(1, 2, 3);
    });

    it('should chain with "async"', function (done) {
      flow(
        map(function (len) {
          var q = this.queue(function (i) {
            this.async(i * 2)();
          });
          for (var i = 0; i < len; i++) {
            q.push(i);
          }
          q.complete();
        }),
        function (results) {
          assert.ok(!this.err);
          assert.deepEqual(results, [ [ 0 ], [ 0, 2 ], [ 0, 2, 4 ] ]);
          done();
        }
      )(1, 2, 3);
    });

  });

  // PARALLEL
  describe('parallel', function () {
    it('should chain with "next"', function (done) {
      flow(
        parallel(
          function (len) {
            var q = this.queue(function (i) {
              this.next(i * 2);
            });
            for (var i = 0; i < len; i++) {
              q.push(i);
            }
            q.complete();
          },
          function (len) {
            var q = this.queue(function (i) {
              this.next(i * 2);
            });
            for (var i = 0; i < len; i++) {
              q.push(i);
            }
            q.complete();
          }
        ),
        function (results) {
          assert.ok(!this.err);
          assert.deepEqual(results, [ [ 0, 2 ], [ 0, 2, 4 ] ]);
          done();
        }
      )(2, 3);
    });

    it('should chain with "async"', function (done) {
      flow(
        parallel(
          function (len) {
            var q = this.queue(function (i) {
              this.async(i * 2)();
            });
            for (var i = 0; i < len; i++) {
              q.push(i);
            }
            q.complete();
          },
          function (len) {
            var q = this.queue(function (i) {
              this.async(i * 2)();
            });
            for (var i = 0; i < len; i++) {
              q.push(i);
            }
            q.complete();
          }
        ),
        function (results) {
          assert.ok(!this.err);
          assert.deepEqual(results, [ [ 0, 2 ], [ 0, 2, 4 ] ]);
          done();
        }
      )(2, 3);
    });
  });

  // PARALLEMAP
  describe('parallelMap', function () {
    it('should chain with "next"', function (done) {
      flow(
        parallelMap(function (len) {
          var q = this.queue(function (i) {
            this.next(i * 2);
          });
          for (var i = 0; i < len; i++) {
            q.push(i);
          }
          q.complete();
        }),
        function (results) {
          assert.ok(!this.err);
          assert.deepEqual(results, [ [ 0 ], [ 0, 2 ], [ 0, 2, 4 ] ]);
          done();
        }
      )(1, 2, 3);
    });

    it('should chain with "async"', function (done) {
      flow(
        parallelMap(function (len) {
          var q = this.queue(function (i) {
            this.async(i * 2)();
          });
          for (var i = 0; i < len; i++) {
            q.push(i);
          }
          q.complete();
        }),
        function (results) {
          assert.ok(!this.err);
          assert.deepEqual(results, [ [ 0 ], [ 0, 2 ], [ 0, 2, 4 ] ]);
          done();
        }
      )(1, 2, 3);
    });
  });

});