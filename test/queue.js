var nue = require('../lib/nue');
var flow = nue.flow;
var assert = require('assert');

describe('queue', function() {

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
        var q = this.queue(function () {
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
        this.err = null;
        assert.ok(!results);
        done();
      }
    )();
  });

  it('should exit with "async"', function (done) {
    flow(
      function () {
        var q = this.queue(function () {
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
        this.err = null;
        assert.ok(!results);
        done();
      }
    )();
  });

});