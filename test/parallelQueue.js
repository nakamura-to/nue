var nue = require('../lib/nue');
var flow = nue.flow;
var each = nue.each;
var parallel = nue.parallel;
var parallelEach = nue.parallel;
var assert = require('assert');

describe('parallelQueue', function() {
  // FLOW
  describe('flow', function () {
    it('should chain with "next"', function (done) {
      flow(
        function () {
          var q = this.parallelQueue(function (i) {
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

    it('should chain with "callback"', function (done) {
      flow(
        function () {
          var q = this.parallelQueue(function (i) {
            this.callback(null, i * 2);
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
          var q = this.parallelQueue(function (i) {
            this.end('ERROR');
          });
          for (var i = 0; i < 10; i++) {
            q.push(i);
          }
          q.complete();
        },
        function (results) {
          assert.strictEqual(this.err, 'ERROR');
          assert.ok(!results);
          done();
        }
      )();
    });

    it('should exit with "callback"', function (done) {
      flow(
        function () {
          var q = this.parallelQueue(function (i) {
            this.callback('ERROR');
          });
          for (var i = 0; i < 10; i++) {
            q.push(i);
          }
          q.complete();
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
  describe('each', function () {
    it('should chain with "next"', function (done) {
      flow(
        each(function (len) {
          var q = this.parallelQueue(function (i) {
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

    it('should chain with "callback"', function (done) {
      flow(
        each(function (len) {
          var q = this.parallelQueue(function (i) {
            this.callback(null, i * 2);
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
            var q = this.parallelQueue(function (i) {
              this.callback(null, i * 2);
            });
            for (var i = 0; i < len; i++) {
              q.push(i);
            }
            q.complete();
          },
          function (len) {
            var q = this.parallelQueue(function (i) {
              this.callback(null, i * 2);
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

    it('should chain with "callback"', function (done) {
      flow(
        parallel(
          function (len) {
            var q = this.parallelQueue(function (i) {
              this.callback(null, i * 2);
            });
            for (var i = 0; i < len; i++) {
              q.push(i);
            }
            q.complete();
          },
          function (len) {
            var q = this.parallelQueue(function (i) {
              this.callback(null, i * 2);
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

});