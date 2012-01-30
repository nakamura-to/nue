var nue = require('../lib/nue');
var assert = require('assert');

describe('seriesQueue', function() {
  it('should chain queued tasks', function (done) {
    var q = nue.seriesQueue(
      function (i){
        this.next();
        if (i === 9) {
          done();
        }
      }
    );
    for (var i = 0; i < 10; i++) {
      q.push(i);
    }
    q.complete();
  });
  it('should accept arguments from the previous task', function (done) {
    var q = nue.seriesQueue(
      function (value, number, string){
        if (this.index === 0) {
          number = 0;
          string = 'hoge';
        }
        this.next(value + number, string);
        if (this.index === 4) {
          assert.strictEqual(number, 6);
          assert.strictEqual(string, 'hoge');
          done();
        }
      }
    );
    for (var i = 0; i < 5; i++) {
      q.push(i);
    }
    q.complete();
  });
});