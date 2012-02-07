var nue = require('../lib/nue');
var flow = nue.flow;
var assert = require('assert');

describe('queue', function() {
  it('should be used in "flow"', function (done) {
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

});