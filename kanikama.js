/*

 Kanikama
 Copyright (c) 2015 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

var geolib;

if (typeof require !== "undefined") {
  geolib = require("geolib");
}

/**
 * ビーコンオブジェクトが同じかどうか評価する
 * @param a
 * @param b
 * @returns {boolean}
 */
function equalBeacon(a, b) {
  return a.uuid.toLowerCase() === b.uuid.toLowerCase() && a.major === b.major && a.minor === b.minor;
}

/**
 * Some utility for beacons buffer
 * @private
 */
class Buffer {
  validate_(beacons) {
    for (var b of beacons) {
      if (typeof b.major !== "number" || typeof b.minor !== "number" || typeof b.rssi !== "number" || typeof b.uuid !== "string") {
        return false;
      }
    }

    return true;
  }

  /**
   * @param length {Number} Length of buffer
   * @param verify {Boolean} Verify data at each push (default:false)
   */
  constructor(length, verify = true) {
    this.length = length;
    this.verify = verify;
    this.buffer = [];
    this.ranged = [];
    this.timeout = 0;
  }

  /**
   * Push new beacons to buffer
   *
   * @param beacons {Object} List of beacons
   * @return {Number} New buffer length
   */
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

  /**
   * Return slice of buffer
   * @param size is should set over 0
   * @returns {*}
   */
  last(size) {
    if (size === 1 && this.timeout > 0) {
      return [this.ranged];
    } else {
      return this.buffer.slice(-1 * size);
    }
  }

  /**
   * Clear buffer
   */
  clear() {
    this.buffer.length = 0;
    this.ranged.length = 0;
    return 0;
  }

  /**
   * Return buffer length
   */
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

  /**
   * 現在選択されている施設のビーコンがバッファにあるか調べる
   *
   * @param windowSize {Number} 調査するバッファの長さ
   * @returns {Boolean} ビーコンの有無
   * @private
   */
  existCurrentFacilityBeacon(windowSize) {
    if (this.currentFacility != null) {
      const buffer = this.buffer.last(windowSize);
      for (let i = 0; i < buffer.length; i++) {
        for (let j = 0; j < buffer[i].length; j++) {
          for (let k = 0; k < this.currentFacility.beacons.length; k++) {
            const a = this.currentFacility.beacons[k];
            const b = buffer[i][j];
            if (equalBeacon(a, b)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * もっとも近い(RSSIが強い)ビーコンの施設を返す
   *
   * @param windowSize {Number} 調査するバッファの長さ
   * @returns {Object} 施設
   * @private
   */
  getNearestFacility(windowSize) {
    let nearestBeacon = null;
    let tmp = this.buffer.last(windowSize);
    for (let beacons of tmp) {
      for (let b of beacons) {
        if (nearestBeacon === null || nearestBeacon.rssi < b.rssi) {
          nearestBeacon = b;
        }
      }
    }

    if (nearestBeacon) {
      for (let facility of this.facilities_) {
        for (let fb of facility.beacons) {
          if (equalBeacon(fb, nearestBeacon)) {
            return facility;
          }
        }
      }
    }

    return null;
  }

  /**
   * バッファを処理して施設を選択す
   *
   * 現在選択されている施設のビーコンがバッファにない場合、新しい施設を選択する
   * @private
   */
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

  /**
   * もっとも近いフロアを返す
   *
   * ・各フロアで一番RSSIが近いビーコンの周囲3メートルのRSSI平均を比較する
   * ・施設が選択されていない状態で呼び出した場合はエラーとなる
   * ・ビーコンに該当するフロアが1つのみの場合はそのフロアを返す
   * @param windowSize {Number} 調査するバッファの長さ
   * @returns {Object} フロア
   * @private
   */
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

  /**
   * バッファを処理してフロアを選択する
   * @private
   */
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

  /**
   * Nearest1アルゴリズムの実装
   *
   * RSSIが最も強いビーコンを現在地として推定する
   * currentFloor.nearest1に条件リストがある場合に動く
   * {
   *   latitude: 緯度
   *   longitude: 経度
   *   beacon: ビーコン
   * }
   *
   * @param beacons {Object} 計測データ
   * @param filter_near {Number} 第2候補との差の閾値
   * @returns {Object} フロア
   * @private
   */
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

  /**
   * NearestDアルゴリズムの実装
   *
   * RSSIが最も強いビーコンとデバイスの向きにより現在地を推定する
   * currentFloor.nearestDに条件リストがある場合に動く
   * {
   *   latitude: 緯度
   *   longitude: 経度
   *   beacon: ビーコン
   *   direction: デバイスの方向(度)
   *   range: directionを中心とした適用範囲(度)
   * }
   *
   * @param beacons {Object} 計測データ  * @param beacons
   * @param filter_near {Number} 第2候補との差の閾値  * @param filter_near
   * @returns {Object} フロア  * @returns {*}
   * @private
   */
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

  /**
   * Nearest2アルゴリズムの実装
   *
   * 2点の平均RSSIの比較により現在地を推定する
   * currentFloor.nearest2に条件リストがある場合に動く
   * {
   *   latitude: 緯度
   *   longitude: 経度
   *   beacons: [ビーコン1,ビーコン2]
   * }
   *
   * @param beacons {Object} 計測データ
   * @param filter_near {Number} 第2候補との差の閾値
   * @returns {Object} フロア
   * @private
   */
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

  /**
   * バッファを処理して現在場所を推定する
   * @private
   */
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

  /**
   * 新しい計測データを追加して状態をアップデートする
   */
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

  /**
   * イベントハンドラーを設定する
   *
   * @param type {String} イベント名
   * @param listener {function} コールバック関数
   * change:headingup (newvalue) - 追従モードの変更を通知する
   * @returns {Kanikama}
   */
  on(type, listener) {
    this.callbacks[type] || (this.callbacks[type] = []);
    this.callbacks[type].push(listener);
    return this;
  }

  /**
   * @nodoc イベントを通知する
   * @param type
   * @param data
   * @private
   */
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