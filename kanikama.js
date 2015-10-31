
/*

Kanikama

Copyright (c) 2015 CALIL Inc.
This software is released under the MIT License.
http://opensource.org/licenses/mit-license.php
 */
var Buffer, Kanikama, equalBeacon, geolib;

if (typeof require !== "undefined") {
  geolib = require('geolib');
}

equalBeacon = function(a, b) {
  return a.uuid.toLowerCase() === b.uuid.toLowerCase() && a.major === b.major && a.minor === b.minor;
};

Buffer = (function() {
  var validate_;

  validate_ = function(beacons) {
    var b, i, len;
    for (i = 0, len = beacons.length; i < len; i++) {
      b = beacons[i];
      if (typeof b.major !== 'number' || typeof b.minor !== 'number' || typeof b.rssi !== 'number' || typeof b.uuid !== 'string') {
        return false;
      }
    }
    return true;
  };

  function Buffer(length, verify) {
    this.length = length;
    this.verify = verify != null ? verify : true;
    this.buffer = [];
  }

  Buffer.prototype.push = function(beacons) {
    var b, i, len;
    for (i = 0, len = beacons.length; i < len; i++) {
      b = beacons[i];
      if (typeof b.major === 'string') {
        b.major = Number(b.major);
      }
      if (typeof b.minor === 'string') {
        b.minor = Number(b.minor);
      }
    }
    if (this.verify && !validate_(beacons)) {
      throw new Error('Invalid Beacons.');
    }
    if (this.buffer.length >= this.length) {
      this.buffer.shift();
    }
    return this.buffer.push(beacons);
  };

  Buffer.prototype.last = function(size) {
    return this.buffer.slice(-1 * size);
  };

  Buffer.prototype.clear = function() {
    this.buffer.length = 0;
    return 0;
  };

  Buffer.prototype.size = function() {
    return this.buffer.length;
  };

  return Buffer;

})();

Kanikama = (function() {
  function Kanikama() {
    this.buffer = new Buffer(10);
    this.uid = 1000000000;
  }

  Kanikama.prototype.facilities_ = null;

  Kanikama.prototype.currentFacility = null;

  Kanikama.prototype.currentFloor = null;

  Kanikama.prototype.currentPosition = null;

  Kanikama.prototype.heading = null;

  Kanikama.prototype.buffer = null;

  Kanikama.prototype.callbacks = {};

  Kanikama.prototype.existCurrentFacilityBeacon = function(windowSize) {
    var b, beacons, fb, i, j, k, len, len1, len2, ref, ref1;
    if (this.currentFacility != null) {
      ref = this.buffer.last(windowSize);
      for (i = 0, len = ref.length; i < len; i++) {
        beacons = ref[i];
        for (j = 0, len1 = beacons.length; j < len1; j++) {
          b = beacons[j];
          ref1 = this.currentFacility.beacons;
          for (k = 0, len2 = ref1.length; k < len2; k++) {
            fb = ref1[k];
            if (equalBeacon(fb, b)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  Kanikama.prototype.getNearestFacility = function(windowSize) {
    var b, beacons, facility, fb, i, j, k, l, len, len1, len2, len3, nearestBeacon, ref, ref1, ref2;
    nearestBeacon = null;
    ref = this.buffer.last(windowSize);
    for (i = 0, len = ref.length; i < len; i++) {
      beacons = ref[i];
      for (j = 0, len1 = beacons.length; j < len1; j++) {
        b = beacons[j];
        if (nearestBeacon === null || nearestBeacon.rssi < b.rssi) {
          nearestBeacon = b;
        }
      }
    }
    if (nearestBeacon) {
      ref1 = this.facilities_;
      for (k = 0, len2 = ref1.length; k < len2; k++) {
        facility = ref1[k];
        ref2 = facility.beacons;
        for (l = 0, len3 = ref2.length; l < len3; l++) {
          fb = ref2[l];
          if (equalBeacon(fb, nearestBeacon)) {
            return facility;
          }
        }
      }
    }
    return null;
  };

  Kanikama.prototype.updateFacility = function() {
    var newFacility;
    if (!this.existCurrentFacilityBeacon(10)) {
      newFacility = this.getNearestFacility(3);
      if (newFacility) {
        this.currentFacility = newFacility;
        this.currentFloor = null;
        this.currentPosition = null;
        return this.dispatch('change:facility', this.currentFacility);
      }
    }
  };

  Kanikama.prototype.getNearestFloor = function(windowSize) {
    var b, beacons, distance, effectiveRange, fb, floor, foundFloor, i, j, k, l, len, len1, len2, len3, len4, len5, len6, m, n, near, nearestFloor, o, ref, ref1, ref2, ref3, ref4, ref5, rssiCount, rssiSum;
    foundFloor = 0;
    ref = this.currentFacility.floors;
    for (i = 0, len = ref.length; i < len; i++) {
      floor = ref[i];
      floor._runtime.beacons = [];
      ref1 = this.buffer.last(windowSize);
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        beacons = ref1[j];
        for (k = 0, len2 = beacons.length; k < len2; k++) {
          b = beacons[k];
          ref2 = floor.beacons;
          for (l = 0, len3 = ref2.length; l < len3; l++) {
            fb = ref2[l];
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
      ref3 = this.currentFacility.floors;
      for (m = 0, len4 = ref3.length; m < len4; m++) {
        floor = ref3[m];
        if (floor._runtime.beacons.length > 0) {
          return floor;
        }
      }
    }
    nearestFloor = null;
    effectiveRange = 3;
    ref4 = this.currentFacility.floors;
    for (n = 0, len5 = ref4.length; n < len5; n++) {
      floor = ref4[n];
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
          ref5 = floor._runtime.beacons.slice(1);
          for (o = 0, len6 = ref5.length; o < len6; o++) {
            b = ref5[o];
            distance = geolib.getDistance(near, b);
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
  };

  Kanikama.prototype.updateFloor = function() {
    var floor, i, len, newFloor, ref;
    ref = this.currentFacility.floors;
    for (i = 0, len = ref.length; i < len; i++) {
      floor = ref[i];
      if (floor._runtime == null) {
        floor._runtime = {
          uid: this.uid++
        };
      }
    }
    if ((this.currentFloor == null) && this.currentFacility.floors.length === 1) {
      this.currentFloor = this.currentFacility.floors[0];
      return this.currentPosition = null;
    } else {
      newFloor = this.getNearestFloor(3);
      if (newFloor != null) {
        newFloor._runtime.lastAppear = new Date();
        if (!this.currentFloor) {
          this.currentFloor = newFloor;
          this.currentPosition = null;
          return this.dispatch('change:floor', this.currentFloor);
        } else if (newFloor._runtime.uid !== this.currentFloor._runtime.uid) {
          if ((new Date()) - this.currentFloor._runtime.lastAppear > 5000) {
            this.currentFloor = newFloor;
            this.currentPosition = null;
            return this.dispatch('change:floor', this.currentFloor);
          }
        }
      }
    }
  };

  Kanikama.prototype.nearest1 = function(beacons, filter_near) {
    var i, len, p, ref;
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
    ref = this.currentFloor.nearest1;
    for (i = 0, len = ref.length; i < len; i++) {
      p = ref[i];
      if (equalBeacon(p.beacon, beacons[0])) {
        p.rssi = beacons[0].rssi;
        p.algorithm = 'nearest1';
        return p;
      }
    }
  };

  Kanikama.prototype.nearestD = function(beacons, filter_near) {
    var end, i, len, p, ref, ref1, ref2, ref3, start;
    if (this.heading == null) {
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
    ref = this.currentFloor.nearestD;
    for (i = 0, len = ref.length; i < len; i++) {
      p = ref[i];
      if (equalBeacon(p.beacon, beacons[0])) {
        p.algorithm = 'nearestD';
        p.rssi = beacons[0].rssi;
        start = p.direction - p.range / 2;
        end = p.direction + p.range / 2;
        if ((start <= (ref1 = this.heading) && ref1 <= end)) {
          return p;
        }
        if (start < 0) {
          if ((start + 360 <= (ref2 = this.heading) && ref2 <= 360)) {
            return p;
          }
        }
        if (end >= 360) {
          if ((0 <= (ref3 = this.heading) && ref3 <= end - 360)) {
            return p;
          }
        }
      }
    }
    return null;
  };

  Kanikama.prototype.nearest2 = function(beacons, filter_near) {
    var a, af, b, bf, candidate, i, len, p, ref;
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
    af = function(_item) {
      return equalBeacon(_item, p.beacons[0]);
    };
    bf = function(_item) {
      return equalBeacon(_item, p.beacons[1]);
    };
    candidate = [];
    ref = this.currentFloor.nearest2;
    for (i = 0, len = ref.length; i < len; i++) {
      p = ref[i];
      a = beacons.filter(af);
      b = beacons.filter(bf);
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
      candidate[0].algorithm = 'nearest2';
      return candidate[0];
    }
    return null;
  };

  Kanikama.prototype.updatePosition = function() {
    var a, accuracy, d, diff, newPosition;
    d = this.buffer.last(1)[0];
    accuracy = 0.1;
    newPosition = this.nearestD(d, 6);
    if (newPosition === null) {
      newPosition = this.nearest2(d, 3);
      if (newPosition === null) {
        accuracy = 3;
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
    if (newPosition !== null) {
      newPosition.accuracy = accuracy;
      this.currentPosition = newPosition;
      this.currentPosition._runtime = {
        lastAppear: new Date(),
        accuracy: accuracy
      };
      return this.dispatch('change:position', this.currentPosition);
    } else if (this.currentPosition !== null) {
      diff = new Date() - this.currentPosition._runtime.lastAppear;
      if (diff > 10000) {
        this.currentPosition = null;
        return this.dispatch('change:position', this.currentPosition);
      } else {
        a = this.currentPosition._runtime.accuracy;
        if (diff > 5000) {
          a *= 5;
        }
        if (diff > 2000) {
          a *= 2;
        }
        if (a >= 20) {
          a = 20;
        }
        if (accuracy !== this.currentPosition.accuracy) {
          this.currentPosition.accuracy = a;
          return this.dispatch('change:position', this.currentPosition);
        }
      }
    }
  };

  Kanikama.prototype.push = function(beacons) {
    this.buffer.push(beacons);
    this.updateFacility();
    if (this.currentFacility !== null) {
      this.updateFloor();
      if (this.currentFloor !== null) {
        return this.updatePosition();
      }
    }
  };

  Kanikama.prototype.on = function(type, listener) {
    var base;
    (base = this.callbacks)[type] || (base[type] = []);
    this.callbacks[type].push(listener);
    return this;
  };

  Kanikama.prototype.dispatch = function(type, data) {
    var callback, chain, i, len, results;
    chain = this.callbacks[type];
    if (chain != null) {
      results = [];
      for (i = 0, len = chain.length; i < len; i++) {
        callback = chain[i];
        results.push(callback(data));
      }
      return results;
    }
  };

  return Kanikama;

})();

if (typeof exports !== 'undefined') {
  module.exports = {
    equalBeacon: equalBeacon,
    Kanikama: Kanikama,
    Buffer: Buffer
  };
}
