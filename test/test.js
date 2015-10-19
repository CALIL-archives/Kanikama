var Buffer, Kanikama, assert, should;

require("blanket");

assert = require('assert');

should = require('should');

Buffer = require('../kanikama').Buffer;

Kanikama = require('../kanikama').Kanikama;

describe('Buffer', function() {
  describe('Initialize', function() {
    it('should not raise errors if length was not provided', function(done) {
      new Buffer();
      return done();
    });
    it('should not raise errors if length provided', function(done) {
      new Buffer(100);
      return done();
    });
    return it('should not raise errors if verify provided', function(done) {
      new Buffer(100, false);
      return done();
    });
  });
  describe('Push', function() {
    it('should not raise errors empty list provided', function(done) {
      var x;
      x = new Buffer(20);
      x.push([]);
      return done();
    });
    it('push less than length', function(done) {
      var a, j, x, y;
      x = new Buffer(20);
      for (a = j = 1; j <= 5; a = ++j) {
        x.push([]);
      }
      y = x.size();
      y.should.equal(5);
      return done();
    });
    it('push over length', function(done) {
      var a, j, x;
      x = new Buffer(20);
      for (a = j = 1; j <= 50; a = ++j) {
        x.push([]);
      }
      x.size().should.equal(20);
      return done();
    });
    it('push invalid beacons1', function(done) {
      var x;
      x = new Buffer();
      (function() {
        return x.push([1]);
      }).should["throw"]();
      return done();
    });
    it('push invalid beacons2', function(done) {
      var x;
      x = new Buffer();
      (function() {
        return x.push([
          {
            "minor": 4,
            "rssi": "123",
            "major": 1,
            "uuid": "00000000-71C7-1001-B000-001C4D532518"
          }
        ]);
      }).should["throw"]();
      return done();
    });
    it('push invalid beacons without verify', function(done) {
      var x;
      x = new Buffer(null, false);
      x.push([1]);
      return done();
    });
    return it('push valid beacons', function(done) {
      var x;
      x = new Buffer();
      x.push([
        {
          "minor": 4,
          "rssi": -60,
          "major": 1,
          "uuid": "00000000-71C7-1001-B000-001C4D532518"
        }
      ]);
      x.push([
        {
          "minor": 4,
          "rssi": -60,
          "major": 1,
          "uuid": "00000000-71C7-1001-B000-001C4D532518"
        }, {
          "minor": 4,
          "rssi": -60,
          "major": 1,
          "uuid": "00000000-71C7-1001-B000-001C4D532518"
        }
      ]);
      x.size().should.equal(2);
      return done();
    });
  });
  describe('Last', function() {
    var x;
    x = new Buffer(5);
    it('acquire last 2 from empty buffer', function(done) {
      var y;
      y = x.last(2);
      y.length.should.equal(0);
      return done();
    });
    it('should not raise errors acquire last 0', function(done) {
      x.last(0);
      return done();
    });
    return it('acquire last 2 from full buffer', function(done) {
      var a, j;
      for (a = j = 1; j <= 50; a = ++j) {
        x.push([]);
      }
      x.last(2).length.should.equal(2);
      return done();
    });
  });
  return describe('Clear', function() {
    var x;
    x = new Buffer(5);
    it('clear empty buffer', function(done) {
      x.clear();
      return done();
    });
    return it('clear full buffer', function(done) {
      var a, j;
      for (a = j = 1; j <= 50; a = ++j) {
        x.push([]);
      }
      x.clear();
      x.size().should.equal(0);
      return done();
    });
  });
});

describe('Facility', function() {
  var B, kanikama;
  B = function(major, minor, rssi) {
    if (rssi == null) {
      rssi = null;
    }
    return {
      uuid: '00000000-71C7-1001-B000-001C4D532518',
      major: major,
      minor: minor,
      rssi: rssi
    };
  };
  kanikama = new Kanikama();
  it('Initial value is null', function(done) {
    var x;
    x = kanikama.currentFacility;
    should.not.exist(x);
    return done();
  });
  it('Set facility table', function(done) {
    kanikama.facilities_ = [
      {
        facility_id: 1,
        name: 'FacilityA',
        beacons: [B(1, 1), B(1, 2)],
        floors: []
      }, {
        facility_id: 2,
        name: 'FacilityB',
        beacons: [B(2, 1), B(2, 2)],
        floors: []
      }
    ];
    return done();
  });
  it('Receive first beacons = A', function(done) {
    kanikama.push([B(1, 1, -50)]);
    kanikama.currentFacility.name.should.equal('FacilityA');
    return done();
  });
  it('Receive unknown beacons', function(done) {
    kanikama.currentFacility = null;
    kanikama.buffer.clear();
    kanikama.push([B(100, 1, -50)]);
    should.not.exist(kanikama.currentFacility);
    return done();
  });
  it('A after B x 5 = A', function(done) {
    var j, k, x;
    for (x = j = 0; j <= 10; x = ++j) {
      kanikama.push([B(1, 1, -50)]);
    }
    for (x = k = 0; k <= 2; x = ++k) {
      kanikama.push([B(2, 1, -50)]);
    }
    kanikama.currentFacility.name.should.equal('FacilityA');
    return done();
  });
  it('A after [A,B] x 10 = A', function(done) {
    var j, k, x;
    for (x = j = 0; j <= 10; x = ++j) {
      kanikama.push([B(1, 1, -50)]);
    }
    for (x = k = 0; k <= 10; x = ++k) {
      kanikama.push([B(2, 1, -50), B(1, 1, -100)]);
    }
    kanikama.currentFacility.name.should.equal('FacilityA');
    return done();
  });
  it('A after B x 10 = B', function(done) {
    var j, k, x;
    for (x = j = 0; j <= 10; x = ++j) {
      kanikama.push([B(1, 1, -50)]);
    }
    for (x = k = 0; k <= 10; x = ++k) {
      kanikama.push([B(2, 1, -50)]);
    }
    kanikama.currentFacility.name.should.equal('FacilityB');
    return done();
  });
  return it('Benchmark less than 0.001ms', function(done) {
    var i, j, k, num, ref, x;
    for (x = j = 0; j <= 10; x = ++j) {
      kanikama.push([B(2, 1, -50)]);
    }
    num = 1000000;
    this.slow(0.001 * num);
    for (i = k = 0, ref = num; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
      kanikama.updateFacility();
    }
    return done();
  });
});

describe('Floor', function() {
  var B, C, kanikama;
  B = function(major, minor, rssi) {
    if (rssi == null) {
      rssi = null;
    }
    return {
      uuid: '00000000-71C7-1001-B000-001C4D532518',
      major: major,
      minor: minor,
      rssi: rssi
    };
  };
  C = function(minor, lat, lon) {
    return {
      uuid: '00000000-71C7-1001-B000-001C4D532518',
      major: 1,
      minor: minor,
      latitude: lat,
      longitude: lon
    };
  };
  kanikama = new Kanikama();
  it('Initial value is null', function(done) {
    should.not.exist(kanikama.currentFloor);
    return done();
  });
  it('Set facility table', function(done) {
    kanikama.facilities_ = [
      {
        facility_id: 1,
        name: 'FacilityA',
        beacons: [B(1, 1), B(1, 2)],
        floors: [
          {
            id: 1,
            beacons: [C(1, 100, 50)]
          }, {
            id: 2,
            beacons: [C(1, 100, 50)]
          }
        ]
      }
    ];
    return done();
  });
  it('Should getNearestFloor without facility is error', function(done) {
    kanikama.currentFacility = null;
    (function() {
      return kanikama.getNearestFloor(1);
    }).should["throw"]();
    return done();
  });
  it('Should select floor immediately if facility has one floor', function(done) {
    kanikama = new Kanikama();
    kanikama.facilities_ = [
      {
        facility_id: 1,
        name: 'FacilityA',
        beacons: [B(1, 1), B(1, 2)],
        floors: [
          {
            id: 1
          }
        ]
      }
    ];
    kanikama.push([B(1, 1, -50)]);
    kanikama.currentFloor.id.should.equal(1);
    return done();
  });
  it('Should select floor immediately if only one floor beacons', function(done) {
    var facilities_;
    facilities_ = [
      {
        facility_id: 1,
        name: 'FacilityA',
        beacons: [B(1, 1), B(1, 2)],
        floors: [
          {
            id: 1,
            beacons: [C(1, 0, 0)]
          }, {
            id: 2,
            beacons: [C(2, 0, 0)]
          }
        ]
      }
    ];
    kanikama = new Kanikama();
    kanikama.facilities_ = facilities_;
    kanikama.push([B(1, 1, -40)]);
    kanikama.currentFloor.id.should.equal(1);
    kanikama = new Kanikama();
    kanikama.facilities_ = facilities_;
    kanikama.push([B(1, 2, -20)]);
    kanikama.currentFloor.id.should.equal(2);
    return done();
  });
  it('Select floor from compare multiple floor\'s beacon', function(done) {
    var facilities_;
    facilities_ = [
      {
        facility_id: 1,
        name: 'FacilityA',
        beacons: [B(1, 1), B(1, 2), B(1, 3), B(1, 4)],
        floors: [
          {
            id: 1,
            beacons: [C(1, 0, 0)]
          }, {
            id: 2,
            beacons: [C(2, 0, 0.00001), C(3, 0, 0.00002), C(4, 0, 0.00003)]
          }
        ]
      }
    ];
    kanikama = new Kanikama();
    kanikama.facilities_ = facilities_;
    kanikama.push([B(1, 1, -10), B(1, 2, -60)]);
    kanikama.push([B(1, 1, -20), B(1, 2, -60)]);
    kanikama.push([B(1, 2, -30), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    return done();
  });
  it('Benchmark less than 0.001ms', function(done) {
    var i, j, k, num, ref, x;
    for (x = j = 0; j <= 10; x = ++j) {
      kanikama.push([B(2, 1, -50)]);
    }
    num = 1000;
    kanikama.push([B(1, 1, -20), B(1, 2, -60)]);
    kanikama.push([B(1, 2, -30), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    this.slow(0.001 * num);
    for (i = k = 0, ref = num; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
      kanikama.updateFloor();
    }
    return done();
  });
  it('Should not change floor less than 5sec', function(done) {
    kanikama.push([B(1, 1, -20), B(1, 2, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    kanikama.currentFloor.id.should.equal(1);
    return done();
  });
  return it('Should change floor over 5sec', function(done) {
    kanikama.push([B(1, 1, -20), B(1, 2, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    this.slow(10000);
    this.timeout(10000);
    return setTimeout(function() {
      kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
      kanikama.currentFloor.id.should.equal(2);
      return done();
    }, 5500);
  });
});

describe('Position', function() {
  var SB, kanikama;
  kanikama = new Kanikama();
  SB = function(minor, rssi) {
    return {
      uuid: '00000000-71C7-1001-B000-001C4D532518',
      major: 105,
      minor: minor,
      rssi: rssi
    };
  };
  it('Initial value is null', function(done) {
    should.not.exist(kanikama.currentPosition);
    return done();
  });
  it('Set facility table', function(done) {
    var fs;
    fs = require("fs");
    kanikama.facilities_ = JSON.parse(fs.readFileSync("test/sabae.json", "utf8"));
    return done();
  });
  it('No error with empty beacon data', function(done) {
    kanikama.push([]);
    return done();
  });
  it('nearest1 x1', function(done) {
    kanikama.push([SB(1, -10)]);
    kanikama.currentPosition.latitude.should.equal(136.18638732106814);
    kanikama.currentPosition.algorithm.should.equal('nearest1');
    return done();
  });
  it('nearest1 x2', function(done) {
    kanikama.push([SB(1, -20), SB(2, -10)]);
    kanikama.currentPosition.latitude.should.equal(136.18641004628117);
    kanikama.currentPosition.algorithm.should.equal('nearest1');
    return done();
  });
  it('nearestD', function(done) {
    throw 'please write test!';
    return done();
  });
  return it('nearest2', function(done) {
    kanikama.push([SB(133, -20), SB(116, -20)]);
    kanikama.currentPosition.latitude.should.equal(136.1863696569712);
    kanikama.currentPosition.algorithm.should.equal('nearest2');
    console.log(kanikama.currentPosition);
    return done();
  });
});
