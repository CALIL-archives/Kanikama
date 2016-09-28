var geolib;

if (typeof require !== "undefined") {
  geolib = require("geolib");
}

var equalBeacon = function(a, b) {
  return a.uuid.toLowerCase() === b.uuid.toLowerCase() && a.major === b.major && a.minor === b.minor;
};

class Buffer {
  validate_(beacons) {
    for (var b of beacons) {
      if (typeof b.major !== "number" || typeof b.minor !== "number" || typeof b.rssi !== "number" || typeof b.uuid !== "string") {
        return false;
      }
    }

    return true;
  }

  constructor(length, verify = true) {
    this.length = length;
    this.verify = verify;
    this.buffer = [];
    this.ranged = [];
    this.timeout = 0;
  }

  push(beacons) {
    var t;

    for (var b of beacons) {
      if (typeof b.major === "string") {
        b.major = Number(b.major);
      }

      if (typeof b.minor === "string") {
        b.minor = Number(b.minor);
      }
    }

    if (this.verify && !this.validate_(beacons)) {
      throw new Error("Invalid Beacons.");
    }

    if (this.buffer.length >= this.length) {
      this.buffer.shift();
    }

    this.buffer.push(beacons);

    if (this.timeout > 0) {
      for (var a of beacons) {
        var found = false;

        for (var b of this.ranged) {
          if (equalBeacon(a, b)) {
            b.rssi = a.rssi;
            b.lastAppear = new Date();
            found = true;
          }
        }

        if (!found) {
          a.lastAppear = new Date();
          this.ranged.push(a);
        }
      }

      t = this.timeout;

      this.ranged = this.ranged.filter(function(c) {
        return new Date() - c.lastAppear < t;
      });
    }

    return true;
  }

  last(size) {
    if (size === 1 && this.timeout > 0) {
      return [this.ranged];
    } else {
      return this.buffer.slice(-1 * size);
    }
  }

  clear() {
    this.buffer.length = 0;
    this.ranged.length = 0;
    return 0;
  }

  size() {
    return this.buffer.length;
  }
}

class Kanikama {
  constructor() {
    this.buffer = new Buffer(10);
    this.uid = 1000000000;
  }

  setTimeout(timeout) {
    return this.buffer.timeout = timeout;
  }

  existCurrentFacilityBeacon(windowSize) {
    if (this.currentFacility != null) {
      for (var beacons of this.buffer.last(windowSize)) {
        for (var b of beacons) {
          for (var fb of this.currentFacility.beacons) {
            if (equalBeacon(fb, b)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  getNearestFacility(windowSize) {
    var nearestBeacon = null;

    for (var beacons of this.buffer.last(windowSize)) {
      for (var b of beacons) {
        if (nearestBeacon === null || nearestBeacon.rssi < b.rssi) {
          nearestBeacon = b;
        }
      }
    }

    if (nearestBeacon) {
      for (var facility of this.facilities_) {
        for (var fb of facility.beacons) {
          if (equalBeacon(fb, nearestBeacon)) {
            return facility;
          }
        }
      }
    }

    return null;
  }

  updateFacility() {
    var newFacility;

    if (!this.existCurrentFacilityBeacon(10)) {
      newFacility = this.getNearestFacility(3);

      if (newFacility) {
        this.currentFacility = newFacility;
        this.currentFloor = null;
        this.currentPosition = null;
        return this.dispatch("change:facility", this.currentFacility);
      }
    }
  }

  getNearestFloor(windowSize) {
    var rssiSum;
    var rssiCount;
    var near;
    var foundFloor = 0;

    for (var floor of this.currentFacility.floors) {
      floor._runtime.beacons = [];

      for (var beacons of this.buffer.last(windowSize)) {
        for (var b of beacons) {
          for (var fb of floor.beacons) {
            if (equalBeacon(fb, b) && b.rssi !== 0) {
              floor._runtime.beacons.push({
                uuid: b.uuid,
                major: b.major,
                minor: b.minor,
                rssi: b.rssi,
                longitude: fb.longitude,
                latitude: fb.latitude
              });

              break;
            }
          }
        }
      }

      if (floor._runtime.beacons.length > 0) {
        foundFloor++;
      }
    }

    if (foundFloor === 1) {
      for (var floor of this.currentFacility.floors) {
        if (floor._runtime.beacons.length > 0) {
          return floor;
        }
      }
    }

    var nearestFloor = null;
    var effectiveRange = 3;

    for (var floor of this.currentFacility.floors) {
      if (floor._runtime.beacons.length > 0) {
        floor._runtime.beacons.sort(function(a, b) {
          return b.rssi - a.rssi;
        });

        if (floor._runtime.beacons.length === 1) {
          floor._runtime.averageRssi = floor._runtime.beacons[0].rssi;
        } else {
          near = floor._runtime.beacons[0];
          rssiCount = 1;
          rssiSum = near.rssi;

          for (var b of floor._runtime.beacons.slice(1)) {
            var distance = geolib.getDistance(near, b);

            if (distance <= effectiveRange) {
              rssiSum += b.rssi;
              rssiCount++;
            }
          }

          floor._runtime.averageRssi = rssiSum / rssiCount;
        }

        if (nearestFloor === null || floor._runtime.averageRssi > nearestFloor._runtime.averageRssi) {
          nearestFloor = floor;
        }
      }
    }

    return nearestFloor;
  }

  updateFloor() {
    var newFloor;

    for (var floor of this.currentFacility.floors) {
      if (!(floor._runtime != null)) {
        floor._runtime = {
          uid: this.uid++
        };
      }
    }

    if (!(this.currentFloor != null) && this.currentFacility.floors.length === 1) {
      this.currentFloor = this.currentFacility.floors[0];
      return this.currentPosition = null;
    } else {
      newFloor = this.getNearestFloor(3);

      if (newFloor != null) {
        newFloor._runtime.lastAppear = new Date();

        if (!this.currentFloor) {
          this.currentFloor = newFloor;
          this.currentPosition = null;
          return this.dispatch("change:floor", this.currentFloor);
        } else if (newFloor._runtime.uid !== this.currentFloor._runtime.uid) {
          if ((new Date()) - this.currentFloor._runtime.lastAppear > 5000) {
            this.currentFloor = newFloor;
            this.currentPosition = null;
            return this.dispatch("change:floor", this.currentFloor);
          }
        }
      }
    }
  }

  nearest1(beacons, filter_near) {
    if (beacons.length === 0) {
      return null;
    }

    if (!this.currentFloor.nearest1) {
      return null;
    }

    beacons = beacons.filter(function(_b) {
      return _b.rssi !== 0;
    });

    beacons.sort(function(_a, _b) {
      return _b.rssi - _a.rssi;
    });

    if (filter_near > 0 && beacons.length > 1 && beacons[0].rssi - beacons[1].rssi <= filter_near) {
      return null;
    }

    for (var p of this.currentFloor.nearest1) {
      if (equalBeacon(p.beacon, beacons[0])) {
        p.rssi = beacons[0].rssi;
        p.algorithm = "nearest1";
        return p;
      }
    }

    return null;
  }

  nearestD(beacons, filter_near) {
    var end;
    var start;

    if (!(this.heading != null)) {
      return null;
    }

    if (beacons.length === 0) {
      return null;
    }

    if (!this.currentFloor.nearestD) {
      return null;
    }

    beacons = beacons.filter(function(_b) {
      return _b.rssi !== 0;
    });

    beacons.sort(function(_a, _b) {
      return _b.rssi - _a.rssi;
    });

    if (filter_near > 0 && beacons.length > 1 && beacons[0].rssi - beacons[1].rssi <= filter_near) {
      return null;
    }

    for (var p of this.currentFloor.nearestD) {
      if (equalBeacon(p.beacon, beacons[0])) {
        p.algorithm = "nearestD";
        p.rssi = beacons[0].rssi;
        start = p.direction - p.range / 2;
        end = p.direction + p.range / 2;

        if (start <= this.heading && this.heading <= end) {
          return p;
        }

        if (start < 0) {
          if (start + 360 <= this.heading && this.heading <= 360) {
            return p;
          }
        }

        if (end >= 360) {
          if (0 <= this.heading && this.heading <= end - 360) {
            return p;
          }
        }
      }
    }

    return null;
  }

  nearest2(beacons, filter_near) {
    if (beacons.length < 2) {
      return null;
    }

    if (!this.currentFloor.nearest2) {
      return null;
    }

    beacons = beacons.filter(function(_item) {
      return _item.rssi !== 0;
    });

    beacons.sort(function(x, y) {
      return y.rssi - x.rssi;
    });

    var af = function(_item) {
      return equalBeacon(_item, p.beacons[0]);
    };

    var bf = function(_item) {
      return equalBeacon(_item, p.beacons[1]);
    };

    var candidate = [];

    for (var p of this.currentFloor.nearest2) {
      var a = beacons.filter(af);
      var b = beacons.filter(bf);

      if (a.length > 0 && b.length > 0) {
        p.rssi = (a[0].rssi + b[0].rssi) / 2;
        candidate.push(p);
      }
    }

    if (candidate.length === 0) {
      return null;
    }

    candidate.sort(function(x, y) {
      return y.rssi - x.rssi;
    });

    if (filter_near > 0) {
      if (candidate.length > 1 && candidate[0].rssi - candidate[1].rssi <= filter_near) {
        return null;
      }
    }

    if (equalBeacon(candidate[0].beacons[0], beacons[0]) || equalBeacon(candidate[0].beacons[1], beacons[0])) {
      candidate[0].algorithm = "nearest2";
      return candidate[0];
    }

    return null;
  }

  updatePosition() {
    var a;
    var diff;
    var d = this.buffer.last(1)[0];
    var accuracy = 0.1;
    var newPosition = this.nearestD(d, 5);

    if (newPosition === null) {
      newPosition = this.nearest2(d, 3);

      if (newPosition === null) {
        accuracy = 3;
        newPosition = this.nearestD(d, 4);

        if (newPosition === null) {
          newPosition = this.nearest1(d, 6);

          if (newPosition === null) {
            accuracy = 6;
            newPosition = this.nearest2(d, 1);

            if (newPosition === null) {
              if (this.currentPosition === null || this.currentPosition.accuracy >= 6) {
                newPosition = this.nearest1(d, 0);
                accuracy = 10;
              }
            }
          }
        }
      }
    }

    if (newPosition !== null) {
      newPosition.accuracy = accuracy;
      this.currentPosition = newPosition;

      this.currentPosition._runtime = {
        lastAppear: new Date(),
        accuracy: accuracy
      };

      return this.dispatch("change:position", this.currentPosition);
    } else if (this.currentPosition !== null) {
      diff = new Date() - this.currentPosition._runtime.lastAppear;

      if (diff > this.buffer.timeout + 10000) {
        this.currentPosition = null;
        return this.dispatch("change:position", this.currentPosition);
      } else {
        a = this.currentPosition._runtime.accuracy;

        if (a < 3) {
          a = 3;
        }

        if (diff > this.buffer.timeout + 5000) {
          a *= 5;
        } else if (diff > this.buffer.timeout + 2000) {
          a *= 2;
        }

        if (a >= 25) {
          a = 25;
        }

        if (a !== this.currentPosition.accuracy) {
          this.currentPosition.accuracy = a;
          return this.dispatch("change:position", this.currentPosition);
        }
      }
    }
  }

  push(beacons) {
    this.buffer.push(beacons);
    this.updateFacility();

    if (this.currentFacility !== null) {
      this.updateFloor();

      if (this.currentFloor !== null) {
        return this.updatePosition();
      }
    }
  }

  on(type, listener) {
    this.callbacks[type] || (this.callbacks[type] = []);
    this.callbacks[type].push(listener);
    return this;
  }

  dispatch(type, data) {
    var chain = this.callbacks[type];

    if (chain != null) {
      return (() => {
        for (var callback of chain) {
          callback(data);
        }
      })();
    }
  }
}

Kanikama.prototype.facilities_ = null;
Kanikama.prototype.currentFacility = null;
Kanikama.prototype.currentFloor = null;
Kanikama.prototype.currentPosition = null;
Kanikama.prototype.heading = null;
Kanikama.prototype.buffer = null;
Kanikama.prototype.callbacks = {};

if (typeof exports !== "undefined") {
  module.exports = {
    equalBeacon: equalBeacon,
    Kanikama: Kanikama,
    Buffer: Buffer
  };
}