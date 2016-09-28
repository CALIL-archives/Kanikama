import 'blanket'
import should from 'should'
import {Buffer, Kanikama, equalBeacon} from "../kanikama"

describe("Utilities", function() {
  return describe("equalBeacon", function() {
    it("should return true when same beacon", function(done) {
      var a = {
        uuid: "A",
        major: 1,
        minor: 1
      };

      var b = {
        uuid: "A",
        major: 1,
        minor: 1
      };

      equalBeacon(a, b).should.equal(true);
      return done();
    });

    it("should return false when different beacon", function(done) {
      var a = {
        uuid: "A",
        major: 1,
        minor: 1
      };

      var b = {
        uuid: "A",
        major: 1,
        minor: 2
      };

      equalBeacon(a, b).should.equal(false);
      return done();
    });

    return it("should return true when same beacon(uuid case)", function(done) {
      var a = {
        uuid: "a",
        major: 1,
        minor: 1
      };

      var b = {
        uuid: "A",
        major: 1,
        minor: 1
      };

      equalBeacon(a, b).should.equal(true);
      return done();
    });
  });
});

describe("Buffer", function() {
  describe("Initialize", function() {
    it("should not raise errors if length was not provided", function(done) {
      new Buffer();
      return done();
    });

    it("should not raise errors if length provided", function(done) {
      new Buffer(100);
      return done();
    });

    return it("should not raise errors if verify provided", function(done) {
      new Buffer(100, false);
      return done();
    });
  });

  describe("Push", function() {
    it("should not raise errors empty list provided", function(done) {
      var x = new Buffer(20);
      x.push([]);
      return done();
    });

    it("push less than length", function(done) {
      var x = new Buffer(20);

      for (var a of [1, 2, 3, 4, 5]) {
        x.push([]);
      }

      var y = x.size();
      y.should.equal(5);
      return done();
    });

    it("push over length", function(done) {
      var x = new Buffer(20);

      for (var a of (function() {
        var i;
        var results = [];

        for (i = 1; i <= 50; i++) {
            results.push(i);
        }

        return results;
      }).apply(this)) {
        x.push([]);
      }

      x.size().should.equal(20);
      return done();
    });

    it("push invalid beacons1", function(done) {
      var x = new Buffer();

      (function() {
        return x.push([1]);
      }).should.throw();

      return done();
    });

    it("push invalid beacons2", function(done) {
      var x = new Buffer();

      (function() {
        return x.push([{
          "minor": 4,
          "rssi": "123",
          "major": 1,
          "uuid": "00000000-71C7-1001-B000-001C4D532518"
        }]);
      }).should.throw();

      return done();
    });

    it("push invalid beacons without verify", function(done) {
      var x = new Buffer(null, false);
      x.push([1]);
      return done();
    });

    return it("push valid beacons", function(done) {
      var x = new Buffer();

      x.push([{
        "minor": 4,
        "rssi": -60,
        "major": 1,
        "uuid": "00000000-71C7-1001-B000-001C4D532518"
      }]);

      x.push([{
        "minor": 4,
        "rssi": -60,
        "major": 1,
        "uuid": "00000000-71C7-1001-B000-001C4D532518"
      }, {
        "minor": 4,
        "rssi": -60,
        "major": 1,
        "uuid": "00000000-71C7-1001-B000-001C4D532518"
      }]);

      x.size().should.equal(2);
      return done();
    });
  });

  describe("Last", function() {
    var x = new Buffer(5);

    it("acquire last 2 from empty buffer", function(done) {
      var y = x.last(2);
      y.length.should.equal(0);
      return done();
    });

    it("should not raise errors acquire last 0", function(done) {
      x.last(0);
      return done();
    });

    return it("acquire last 2 from full buffer", function(done) {
      for (var a of (function() {
        var i;
        var results = [];

        for (i = 1; i <= 50; i++) {
            results.push(i);
        }

        return results;
      }).apply(this)) {
        x.push([]);
      }

      x.last(2).length.should.equal(2);
      return done();
    });
  });

  return describe("Clear", function() {
    var x = new Buffer(5);

    it("clear empty buffer", function(done) {
      x.clear();
      return done();
    });

    return it("clear full buffer", function(done) {
      for (var a of (function() {
        var i;
        var results = [];

        for (i = 1; i <= 50; i++) {
            results.push(i);
        }

        return results;
      }).apply(this)) {
        x.push([]);
      }

      x.clear();
      x.size().should.equal(0);
      return done();
    });
  });
});

describe("Facility", function() {
  var B = function(major, minor, rssi = null) {
    return {
      uuid: "00000000-71C7-1001-B000-001C4D532518",
      major: major,
      minor: minor,
      rssi: rssi
    };
  };

  var kanikama = new Kanikama();

  it("Initial value is null", function(done) {
    var x = kanikama.currentFacility;
    should.not.exist(x);
    return done();
  });

  it("Set facility table", function(done) {
    kanikama.facilities_ = [{
      facility_id: 1,
      name: "FacilityA",
      beacons: [B(1, 1), B(1, 2)],
      floors: []
    }, {
      facility_id: 2,
      name: "FacilityB",
      beacons: [B(2, 1), B(2, 2)],
      floors: []
    }];

    return done();
  });

  it("Receive first beacons = A", function(done) {
    kanikama.push([B(1, 1, -50)]);
    kanikama.currentFacility.name.should.equal("FacilityA");
    return done();
  });

  it("Receive unknown beacons", function(done) {
    kanikama.currentFacility = null;
    kanikama.buffer.clear();
    kanikama.push([B(100, 1, -50)]);
    should.not.exist(kanikama.currentFacility);
    return done();
  });

  it("A after B x 5 = A", function(done) {
    for (var x of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      kanikama.push([B(1, 1, -50)]);
    }

    for (var x of [0, 1, 2]) {
      kanikama.push([B(2, 1, -50)]);
    }

    kanikama.currentFacility.name.should.equal("FacilityA");
    return done();
  });

  it("A after [A,B] x 10 = A", function(done) {
    for (var x of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      kanikama.push([B(1, 1, -50)]);
    }

    for (var x of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      kanikama.push([B(2, 1, -50), B(1, 1, -100)]);
    }

    kanikama.currentFacility.name.should.equal("FacilityA");
    return done();
  });

  it("A after B x 10 = B", function(done) {
    for (var x of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      kanikama.push([B(1, 1, -50)]);
    }

    for (var x of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      kanikama.push([B(2, 1, -50)]);
    }

    kanikama.currentFacility.name.should.equal("FacilityB");
    return done();
  });

  return it("Benchmark less than 0.001ms", function(done) {
    for (var x of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      kanikama.push([B(2, 1, -50)]);
    }

    var num = 1000000;
    this.slow(0.001 * num);

    for (var i of (function() {
        var results = [];

        for (var i = 0; (0 <= num ? i <= num : i >= num); (0 <= num ? i++ : i--)) {
            results.push(i);
        }

        return results;
    }).apply(this)) {
      kanikama.updateFacility();
    }

    return done();
  });
});

describe("Floor", function() {
  var B = function(major, minor, rssi = null) {
    return {
      uuid: "00000000-71C7-1001-B000-001C4D532518",
      major: major,
      minor: minor,
      rssi: rssi
    };
  };

  var C = function(minor, lat, lon) {
    return {
      uuid: "00000000-71C7-1001-B000-001C4D532518",
      major: 1,
      minor: minor,
      latitude: lat,
      longitude: lon
    };
  };

  var kanikama = new Kanikama();

  it("Initial value is null", function(done) {
    should.not.exist(kanikama.currentFloor);
    return done();
  });

  it("Set facility table", function(done) {
    kanikama.facilities_ = [{
      facility_id: 1,
      name: "FacilityA",
      beacons: [B(1, 1), B(1, 2)],

      floors: [{
        id: 1,
        beacons: [C(1, 100, 50)]
      }, {
        id: 2,
        beacons: [C(1, 100, 50)]
      }]
    }];

    return done();
  });

  it("Should getNearestFloor without facility is error", function(done) {
    kanikama.currentFacility = null;

    (function() {
      return kanikama.getNearestFloor(1);
    }).should.throw();

    return done();
  });

  it(
    "Should select floor immediately if facility has one floor",
    function(done) {
      kanikama = new Kanikama();

      kanikama.facilities_ = [{
        facility_id: 1,
        name: "FacilityA",
        beacons: [B(1, 1), B(1, 2)],

        floors: [{
          id: 1
        }]
      }];

      kanikama.push([B(1, 1, -50)]);
      kanikama.currentFloor.id.should.equal(1);
      return done();
    }
  );

  it(
    "Should select floor immediately if only one floor beacons",
    function(done) {
      var facilities_ = [{
        facility_id: 1,
        name: "FacilityA",
        beacons: [B(1, 1), B(1, 2)],

        floors: [{
          id: 1,
          beacons: [C(1, 0, 0)]
        }, {
          id: 2,
          beacons: [C(2, 0, 0)]
        }]
      }];

      kanikama = new Kanikama();
      kanikama.facilities_ = facilities_;
      kanikama.push([B(1, 1, -40)]);
      kanikama.currentFloor.id.should.equal(1);
      kanikama = new Kanikama();
      kanikama.facilities_ = facilities_;
      kanikama.push([B(1, 2, -20)]);
      kanikama.currentFloor.id.should.equal(2);
      return done();
    }
  );

  it("Select floor from compare multiple floor's beacon", function(done) {
    var facilities_ = [{
      facility_id: 1,
      name: "FacilityA",
      beacons: [B(1, 1), B(1, 2), B(1, 3), B(1, 4)],

      floors: [{
        id: 1,
        beacons: [C(1, 0, 0)]
      }, {
        id: 2,
        beacons: [C(2, 0, 0.00001), C(3, 0, 0.00002), C(4, 0, 0.00003)]
      }]
    }];

    kanikama = new Kanikama();
    kanikama.facilities_ = facilities_;
    kanikama.push([B(1, 1, -10), B(1, 2, -60)]);
    kanikama.push([B(1, 1, -20), B(1, 2, -60)]);
    kanikama.push([B(1, 2, -30), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    return done();
  });

  it("Benchmark less than 0.001ms", function(done) {
    for (var x of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      kanikama.push([B(2, 1, -50)]);
    }

    var num = 1000;
    kanikama.push([B(1, 1, -20), B(1, 2, -60)]);
    kanikama.push([B(1, 2, -30), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    this.slow(0.001 * num);

    for (var i of (function() {
        var results = [];

        for (var i = 0; (0 <= num ? i <= num : i >= num); (0 <= num ? i++ : i--)) {
            results.push(i);
        }

        return results;
    }).apply(this)) {
      kanikama.updateFloor();
    }

    return done();
  });

  it("Should not change floor less than 5sec", function(done) {
    kanikama.push([B(1, 1, -20), B(1, 2, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    kanikama.push([B(1, 2, -40), B(1, 3, -60)]);
    kanikama.currentFloor.id.should.equal(1);
    return done();
  });

  return it("Should change floor over 5sec", function(done) {
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

describe("Position", function() {
  var kanikama = new Kanikama();

  var SB = function(minor, rssi) {
    return {
      uuid: "00000000-71C7-1001-B000-001C4D532518",
      major: 105,
      minor: minor,
      rssi: rssi
    };
  };

  it("Initial value is null", function(done) {
    should.not.exist(kanikama.currentPosition);
    return done();
  });

  it("Set facility table", function(done) {
    var fs = require("fs");
    kanikama.facilities_ = JSON.parse(fs.readFileSync("test/sabae.json", "utf8"));
    return done();
  });

  it("No error with empty beacon data", function(done) {
    kanikama.push([]);
    return done();
  });

  it("nearest1 x1", function(done) {
    kanikama.push([SB(1, -10)]);
    kanikama.currentPosition.latitude.should.equal(136.18638732106814);
    kanikama.currentPosition.algorithm.should.equal("nearest1");
    return done();
  });

  it("nearest1 x2", function(done) {
    kanikama.push([SB(1, -20), SB(2, -10)]);
    kanikama.currentPosition.latitude.should.equal(136.18641004628117);
    kanikama.currentPosition.algorithm.should.equal("nearest1");
    return done();
  });

  it("nearestD top (direction = 0, range = 90)", function(done) {
    kanikama.buffer.clear();

    for (var heading of (function() {
      var i;
      var results = [];

      for (i = 315; i <= 359; i++) {
          results.push(i);
      }

      return results;
    }).apply(this)) {
      kanikama.heading = heading;
      kanikama.push([SB(39, -20)]);
      kanikama.currentPosition.latitude.should.equal(136.18627059384187);
      kanikama.currentPosition.algorithm.should.equal("nearestD");
    }

    for (var heading of (function() {
      var j;
      var results1 = [];

      for (j = 0; j <= 45; j++) {
          results1.push(j);
      }

      return results1;
    }).apply(this)) {
      kanikama.heading = heading;
      kanikama.push([SB(39, -20)]);
      kanikama.currentPosition.latitude.should.equal(136.18627059384187);
      kanikama.currentPosition.algorithm.should.equal("nearestD");
    }

    return done();
  });

  it("nearestD bottom (direction = 180, range = 90)", function(done) {
    kanikama.buffer.clear();

    for (var heading of (function() {
      var i;
      var results = [];

      for (i = 135; i <= 225; i++) {
          results.push(i);
      }

      return results;
    }).apply(this)) {
      kanikama.heading = heading;
      kanikama.push([SB(39, -20)]);
      kanikama.currentPosition.latitude.should.equal(136.18626991863806);
      kanikama.currentPosition.algorithm.should.equal("nearestD");
    }

    return done();
  });

  it("nearest2 x1", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(133, -20), SB(116, -20)]);
    kanikama.currentPosition.latitude.should.equal(136.1863696569712);
    kanikama.currentPosition.algorithm.should.equal("nearest2");
    return done();
  });

  it("nearest2 x2", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(133, -20), SB(116, -20), SB(101, -30), SB(117, -30)]);
    kanikama.currentPosition.latitude.should.equal(136.1863696569712);
    kanikama.currentPosition.algorithm.should.equal("nearest2");
    return done();
  });

  it("nearest2 x2 filter near", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(133, -20), SB(116, -20), SB(101, -22), SB(117, -22)]);
    kanikama.currentPosition.accuracy.should.equal(6);
    return done();
  });

  it("if no beacon continue previous position", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(39, -20)]);
    var tmp = kanikama.currentPosition;
    kanikama.push([]);
    tmp.latitude.should.equal(kanikama.currentPosition.latitude);
    return done();
  });

  it("Can detect string minor", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB("39", -20)]);
    return done();
  });

  return it("increase accuracy if no detect.", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(133, -20), SB(116, -20), SB(101, -30), SB(117, -30)]);
    var t1 = 3;
    this.slow(25000);
    this.timeout(30000);

    return setTimeout(function() {
      kanikama.push([]);
      kanikama.currentPosition.accuracy.should.equal(t1 * 2);

      return setTimeout(function() {
        kanikama.push([]);
        kanikama.currentPosition.accuracy.should.equal(t1 * 5);

        return setTimeout(function() {
          kanikama.push([]);
          should.not.exist(kanikama.currentPosition);
          return done();
        }, 5500);
      }, 3200);
    }, 2200);
  });
});

describe("Position (with timeout)", function() {
  var kanikama = new Kanikama();
  kanikama.setTimeout(5000);

  var SB = function(minor, rssi) {
    return {
      uuid: "00000000-71C7-1001-B000-001C4D532518",
      major: 105,
      minor: minor,
      rssi: rssi
    };
  };

  it("Initial value is null", function(done) {
    should.not.exist(kanikama.currentPosition);
    return done();
  });

  it("Set facility table", function(done) {
    var fs = require("fs");
    kanikama.facilities_ = JSON.parse(fs.readFileSync("test/sabae.json", "utf8"));
    return done();
  });

  it("No error with empty beacon data", function(done) {
    kanikama.buffer.clear();
    kanikama.push([]);
    return done();
  });

  it("nearest1 x1", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(1, -10)]);
    kanikama.currentPosition.latitude.should.equal(136.18638732106814);
    kanikama.currentPosition.algorithm.should.equal("nearest1");
    return done();
  });

  it("nearest1 x2", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(1, -20), SB(2, -10)]);
    kanikama.currentPosition.latitude.should.equal(136.18641004628117);
    kanikama.currentPosition.algorithm.should.equal("nearest1");
    return done();
  });

  it("nearestD top (direction = 0, range = 90)", function(done) {
    kanikama.buffer.clear();

    for (var heading of (function() {
      var i;
      var results = [];

      for (i = 315; i <= 359; i++) {
          results.push(i);
      }

      return results;
    }).apply(this)) {
      kanikama.heading = heading;
      kanikama.push([SB(39, -20)]);
      kanikama.currentPosition.latitude.should.equal(136.18627059384187);
      kanikama.currentPosition.algorithm.should.equal("nearestD");
    }

    for (var heading of (function() {
      var j;
      var results1 = [];

      for (j = 0; j <= 45; j++) {
          results1.push(j);
      }

      return results1;
    }).apply(this)) {
      kanikama.heading = heading;
      kanikama.push([SB(39, -20)]);
      kanikama.currentPosition.latitude.should.equal(136.18627059384187);
      kanikama.currentPosition.algorithm.should.equal("nearestD");
    }

    return done();
  });

  it("nearestD bottom (direction = 180, range = 90)", function(done) {
    kanikama.buffer.clear();

    for (var heading of (function() {
      var i;
      var results = [];

      for (i = 135; i <= 225; i++) {
          results.push(i);
      }

      return results;
    }).apply(this)) {
      kanikama.heading = heading;
      kanikama.push([SB(39, -20)]);
      kanikama.currentPosition.latitude.should.equal(136.18626991863806);
      kanikama.currentPosition.algorithm.should.equal("nearestD");
    }

    return done();
  });

  it("nearest2 x1", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(133, -20), SB(116, -20)]);
    kanikama.currentPosition.latitude.should.equal(136.1863696569712);
    kanikama.currentPosition.algorithm.should.equal("nearest2");
    return done();
  });

  it("nearest2 x2", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(133, -20), SB(116, -20), SB(101, -30), SB(117, -30)]);
    kanikama.currentPosition.latitude.should.equal(136.1863696569712);
    kanikama.currentPosition.algorithm.should.equal("nearest2");
    return done();
  });

  it("nearest2 x2 filter near", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(133, -20), SB(116, -20), SB(101, -22), SB(117, -22)]);
    kanikama.currentPosition.accuracy.should.equal(6);
    return done();
  });

  it("if no beacon continue previous position", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(39, -20)]);
    var tmp = kanikama.currentPosition;
    kanikama.push([]);
    tmp.latitude.should.equal(kanikama.currentPosition.latitude);
    return done();
  });

  it("Can detect string minor", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB("39", -20)]);
    return done();
  });

  return it("increase accuracy if no detect.", function(done) {
    kanikama.buffer.clear();
    kanikama.push([SB(133, -20), SB(116, -20), SB(101, -30), SB(117, -30)]);
    var t1 = 3;
    this.slow(25000);
    this.timeout(30000);

    return setTimeout(function() {
      kanikama.push([]);
      kanikama.currentPosition.accuracy.should.equal(t1 * 2);

      return setTimeout(function() {
        kanikama.push([]);
        kanikama.currentPosition.accuracy.should.equal(t1 * 5);

        return setTimeout(function() {
          kanikama.push([]);
          should.not.exist(kanikama.currentPosition);
          return done();
        }, 5500);
      }, 3200);
    }, 2200 + 5000);
  });
});