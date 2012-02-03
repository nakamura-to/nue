var serialQueue = require('../lib/nue').serialQueue;
var assert = require('assert');

describe('serialQueue', function() {
  it('should chain queued tasks', function (done) {
    var q = serialQueue(
      function (i) {
        if (this.isFirst) {
          this.data = [];
        }
        this.data.push(i);
        if (this.isLast) {
          assert.deepEqual(this.data, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
          done();
        }
        this.next();
      }
    );
    for (var i = 0; i < 10; i++) {
      q.push(i);
    }
    q.complete();
  });
  it('should accept arguments from the previous task', function (done) {
    var q = serialQueue(
      function (i) {
        this.next(i * 2);
      },
      function (err, results) {
        assert.strictEqual(null, err);
        assert.strictEqual(results.length, 5);
        assert.strictEqual(results[0], 0);
        assert.strictEqual(results[1], 2);
        assert.strictEqual(results[2], 4);
        assert.strictEqual(results[3], 6);
        assert.strictEqual(results[4], 8);
        done();
      }
    );
    for (var i = 0; i < 5; i++) {
      q.push(i);
    }
    q.complete();
  });
});