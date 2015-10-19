# Kanikama
#
# Copyright (c) 2015 CALIL Inc.
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

if typeof require isnt "undefined"
  geolib = require('geolib')

# ビーコンオブジェクトが同じかどうか評価する
#
equalBeacon = (a, b)->
  if a.uuid is b.uuid and a.major is b.major and a.minor is b.minor
    return true
  else
    return false

# Some utility for beacons buffer
#
# @private
#
class Buffer
  validate_ = (beacons)->
    for b in beacons
      if !b.major? or !b.minor? or !b.uuid? or !b.rssi?
        return false
      if typeof b.major isnt 'number' or typeof b.minor isnt 'number' or typeof b.rssi isnt 'number' or typeof b.uuid isnt 'string'
        return false
    return true

  # @param length {Number} Length of buffer
  # @param verify {Boolean} Verify data at each push (default:false)
  #
  constructor: (@length, @verify = true)->
    @buffer = []

  # Push new beacons to buffer
  #
  # @param beacons {Object} List of beacons
  # @return {Number} New buffer length
  #
  push: (beacons)->
    if @verify and !validate_(beacons)
      throw new Error('Invalid Beacons.')
    if @buffer.length >= @length
      @buffer.shift()
    return @buffer.push(beacons)

  # Return slice of buffer
  #
  last: (size)->
    if size > 0
      return @buffer.slice(-1 * size)
    return []

  # Clear buffer
  #
  clear: ->
    @buffer.length = 0
    return 0

  # Return buffer length
  #
  size: ->
    @buffer.length


# Kanikama.js2 位置推定ライブラリ
#
#  @author sakai@calil.jp
#
class Kanikama
  constructor: ->
    @buffer = new Buffer(10)

  facilities_: null
  # 現在選択されている施設
  currentFacility: null
  # 現在選択されているフロア
  currentFloor: null
  # 現在地
  currentPosition: null
  # デバイスの向いている方向(度/null)
  heading: null
  # 内部用UID
  uid: 1000000000
  # 計測データのバッファ
  buffer: null

  # 現在選択されている施設のビーコンがバッファにあるか調べる
  #
  # @private
  # @param windowSize {Number} 調査するバッファの長さ
  # @return {Boolean} ビーコンの有無
  #
  existCurrentFacilityBeacon: (windowSize)->
    if @currentFacility?
      for beacons in @buffer.last(windowSize)
        for b in beacons
          for fb in @currentFacility.beacons
            if equalBeacon(fb, b)
              return true
    return false

  # もっとも近い(RSSIが強い)ビーコンの施設を返す
  #
  # @private
  # @param windowSize {Number} 調査するバッファの長さ
  # @return {Object} 施設
  #
  getNearestFacility: (windowSize)->
    nearestBeacon = null
    for beacons in @buffer.last(windowSize)
      for b in beacons
        if nearestBeacon is null or nearestBeacon.rssi < b.rssi
          nearestBeacon = b
    if nearestBeacon
      for facility in @facilities_
        for fb in facility.beacons
          if equalBeacon(fb, nearestBeacon)
            return facility
    return null

  # バッファを処理して施設を選択する
  #
  # @private
  # 現在選択されている施設のビーコンがバッファにない場合、
  # 新しい施設を選択する
  #
  updateFacility: ->
    if not @existCurrentFacilityBeacon(10)
      newFacility = @getNearestFacility(3)
      if newFacility
        @currentFacility = newFacility
        @currentFloor = null
        @currentPosition = null


  # もっとも近いフロアを返す
  #
  # ・各フロアで一番RSSIが近いビーコンの周囲3メートルのRSSI平均を比較する
  # ・施設が選択されていない状態で呼び出した場合はエラーとなる
  # ・ビーコンに該当するフロアが1つのみの場合はそのフロアを返す
  # @private
  # @param windowSize {Number} 調査するバッファの長さ
  # @return {Object} フロア
  #
  getNearestFloor: (windowSize)->
    if not @currentFacility?
      throw('current facility is not set.')

    # ビーコンをフロア毎に仕分ける
    # RSSIが0のビーコンは無視する
    foundFloor = 0
    for floor in @currentFacility.floors
      floor._runtime.beacons = []
      for beacons in @buffer.last(windowSize)
        for b in beacons
          for fb in floor.beacons
            if equalBeacon(fb, b) and b.rssi != 0
              floor._runtime.beacons.push({
                uuid: b.uuid
                major: b.major
                minor: b.minor
                rssi: b.rssi
                longitude: fb.longitude
                latitude: fb.latitude
              })
              break
      if floor._runtime.beacons.length > 0
        foundFloor++

    # 見つかったフロアがひとつの場合はフロアを確定
    if foundFloor == 1
      for floor in @currentFacility.floors
        if floor._runtime.beacons.length > 0
          return floor

    # 各フロアでRSSIが最も強いビーコンの周囲3mのビーコンの平均RSSIを計算
    # 最も平均RSSIが高いフロアを返す
    nearestFloor = null
    effectiveRange = 3
    for floor in @currentFacility.floors
      if floor._runtime.beacons.length > 0
        floor._runtime.beacons.sort((a, b)-> b.rssi - a.rssi)
        if floor._runtime.beacons.length == 1
          floor._runtime.averageRssi = floor._runtime.beacons[0].rssi
        else
          near = floor._runtime.beacons[0]
          rssiCount = 1
          rssiSum = near.rssi
          for b in floor._runtime.beacons.slice(1)
            distance = geolib.getDistance(near, b)
            if distance <= effectiveRange
              rssiSum += b.rssi
              rssiCount++
          floor._runtime.averageRssi = rssiSum / rssiCount
        if nearestFloor is null or floor._runtime.averageRssi > nearestFloor._runtime.averageRssi
          nearestFloor = floor
    return nearestFloor


  # バッファを処理してフロアを選択する【フロア】
  #
  # @private
  # フロアが1つしかない場合は即時フロアを確定する
  # 過去3回分の計測データが連続して新しいフロアの場合は切り替える
  #
  updateFloor: ->
    # フロアのランタイム変数を初期化
    # 識別のためのユニークなID(UID)を設定
    for floor in @currentFacility.floors
      if not floor._runtime?
        floor._runtime = {uid: @uid++}
    if not @currentFloor? and @currentFacility.floors.length is 1
      @currentFloor = @currentFacility.floors[0]
      @currentPosition = null
    else
      newFloor = @getNearestFloor(3)
      if newFloor?
        newFloor._runtime.lastAppear = new Date()
        if not @currentFloor
          @currentFloor = newFloor
          @currentPosition = null
        else if newFloor._runtime.uid != @currentFloor._runtime.uid
          # 現在のフロアを5秒間以上検出していない場合は切り替え
          if (new Date()) - @currentFloor._runtime.lastAppear > 5000
            @currentFloor = newFloor
            @currentPosition = null

  # Nearest1アルゴリズムの実装
  #
  # @private
  # RSSIが最も強いビーコンを現在地として推定する
  # currentFloor.nearest1に条件リストがある場合に動く
  # {
  #   latitude: 緯度
  #   longitude: 経度
  #   beacon: ビーコン
  # }
  #
  # @param beacons {Object} 計測データ
  # @param filter_near {Number} 第2候補との差の閾値
  # @return {Object} フロア
  #
  nearest1: (beacons, filter_near)->
    if beacons.length == 0
      return null
    if not @currentFloor.nearest1
      return null
    beacons = beacons.filter((_b)-> _b.rssi isnt 0)
    beacons.sort((_a, _b)-> _b.rssi - _a.rssi)
    if filter_near > 0 and beacons.length > 1 and beacons[0].rssi - beacons[1].rssi <= filter_near
      return null
    for p in @currentFloor.nearest1
      if equalBeacon(p.beacon, beacons[0])
        p.rssi = beacons[0].rssi
        p.algorithm = 'nearest1'
        return p

  # NearestDアルゴリズムの実装
  #
  # @private
  # RSSIが最も強いビーコンとデバイスの向きにより現在地を推定する
  # currentFloor.nearestDに条件リストがある場合に動く
  # {
  #   latitude: 緯度
  #   longitude: 経度
  #   beacon: ビーコン
  #   direction: デバイスの方向(度)
  #   range: directionを中心とした適用範囲(度)
  # }
  #
  # @param beacons {Object} 計測データ
  # @param filter_near {Number} 第2候補との差の閾値
  # @return {Object} フロア
  #
  nearestD: (beacons, filter_near)->
    if not @heading?
      return null
    if beacons.length == 0
      return null
    if not @currentFloor.nearestD
      return null
    beacons = beacons.filter((_b)-> _b.rssi isnt 0)
    beacons.sort((_a, _b)-> _b.rssi - _a.rssi)
    if filter_near > 0 and beacons.length > 1 and beacons[0]['rssi'] - beacons[1]['rssi'] < filter_near
      return null
    for p in @currentFloor.nearestD
      if equalBeacon(p.beacon, beacons[0])
        start = p.direction - p.range / 2
        end = p.direction + p.range / 2
        if start <= @heading <= end
          p.algorithm = 'nearestD'
          return p
        if start < 0
          if start + 360 <= @heading <= 360
            p.algorithm = 'nearestD'
            return p
        if end >= 360
          if 0 <= @heading <= end - 360
            p.algorithm = 'nearestD'
            return p
    return null

  # Nearest2アルゴリズムの実装
  #
  # @private
  # 2点の平均RSSIの比較により現在地を推定する
  # currentFloor.nearest2に条件リストがある場合に動く
  # {
  #   latitude: 緯度
  #   longitude: 経度
  #   beacons: [ビーコン1,ビーコン2]
  # }
  #
  # @param beacons {Object} 計測データ
  # @param filter_near {Number} 第2候補との差の閾値
  # @return {Object} フロア
  #
  nearest2: (beacons, filter_near)->
    if beacons.length < 2
      return null
    if not @currentFloor.nearest2
      return null
    beacons = beacons.filter((_item)-> _item.rssi isnt 0)
    beacons.sort((x, y)-> y.rssi - x.rssi)

    candidate = []
    for p in  @currentFloor.nearest2
      beacon_a = beacons.filter((_item)-> equalBeacon(_item, p.beacons[0]))
      beacon_b = beacons.filter((_item)-> equalBeacon(_item, p.beacons[1]))
      if beacon_a.length > 0 and beacon_b.length > 0
        p.rssi = (beacon_a[0].rssi + beacon_b[0].rssi) / 2
        candidate.push(p)

    if candidate.length is 0
      return null

    candidate.sort((x, y)-> y.rssi - x.rssi)
    if filter_near > 0
      if candidate.length > 1 and candidate[0].rssi - candidate[1].rssi <= filter_near
        return null

    # どちらかがトップであれば返す
    if equalBeacon(candidate[0].beacons[0], beacons[0]) or equalBeacon(candidate[0].beacons[1], beacons[0])
      candidate[0].algorithm = 'nearest2'
      return candidate[0]
    return null

  # バッファを処理して現在場所を推定する
  #
  # @private
  #
  updatePosition: ->
    d = @buffer.last(1)[0]
    accuracy = 0.1
    newPosition = @nearestD(d, 6)
    if not newPosition?
      newPosition = @nearest2(d, 3)
      if not newPosition?
        accuracy = 3
        newPosition = @nearest1(d, 6)
        if not newPosition?
          accuracy = 6
          newPosition = @nearest2(d, 1)
          if not newPosition?
            newPosition = @nearest1(d, 0)
            accuracy = 10
    if newPosition?
      newPosition.accuracy = accuracy
      @currentPosition = newPosition


  # 新しい計測データを追加して状態をアップデートする
  #
  push: (beacons)->
    @buffer.push(beacons)
    @updateFacility()
    if @currentFacility
      @updateFloor()
      if @currentFloor
        @updatePosition()


if typeof exports isnt 'undefined'
  module.exports =
    Kanikama: Kanikama
    Buffer: Buffer