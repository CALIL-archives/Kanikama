require("blanket")

assert = require('assert')
should = require('should')
Buffer = require('../kanikama').Buffer
Kanikama = require('../kanikama').Kanikama

describe 'Buffer', ->
  describe 'Initialize', ->
    it 'should not raise errors if length was not provided', (done)->
      new Buffer()
      done()

    it 'should not raise errors if length provided', (done)->
      new Buffer(100)
      done()

    it 'should not raise errors if verify provided', (done)->
      new Buffer(100, false)
      done()

  describe 'Push', ->
    it 'should not raise errors empty list provided', (done)->
      x = new Buffer(20)
      x.push([])
      done()

    it 'push less than length', (done)->
      x = new Buffer(20)
      for a in [1..5]
        x.push([])
      y = x.size()
      y.should.equal(5)
      done()

    it 'push over length', (done)->
      x = new Buffer(20)
      for a in [1..50]
        x.push([])
      x.size().should.equal(20)
      done()

    it 'push invalid beacons1', (done)->
      x = new Buffer()
      (-> x.push([1]) ).should.throw()
      done()

    it 'push invalid beacons2', (done)->
      x = new Buffer()
      (-> x.push([{
        "minor": 4,
        "rssi": "123",
        "major": 1,
        "uuid": "00000000-71C7-1001-B000-001C4D532518"
      }])).should.throw()
      done()

    it 'push invalid beacons without verify', (done)->
      x = new Buffer(null, false)
      x.push([1])
      done()

    it 'push valid beacons', (done)->
      x = new Buffer()
      x.push([{"minor": 4, "rssi": -60, "major": 1, "uuid": "00000000-71C7-1001-B000-001C4D532518"}])
      x.push([{"minor": 4, "rssi": -60, "major": 1, "uuid": "00000000-71C7-1001-B000-001C4D532518"},
        {"minor": 4, "rssi": -60, "major": 1, "uuid": "00000000-71C7-1001-B000-001C4D532518"}])
      x.size().should.equal(2)
      done()

  describe 'Last', ->
    x = new Buffer(5)
    it 'acquire last 2 from empty buffer', (done)->
      y = x.last(2)
      y.length.should.equal(0)
      done()

    it 'should not raise errors acquire last 0', (done)->
      x.last(0)
      done()

    it 'acquire last 2 from full buffer', (done)->
      for a in [1..50]
        x.push([])
      x.last(2).length.should.equal(2)
      done()

  describe 'Clear', ->
    x = new Buffer(5)
    it 'clear empty buffer', (done)->
      x.clear()
      done()

    it 'clear full buffer', (done)->
      for a in [1..50]
        x.push([])
      x.clear()
      x.size().should.equal(0)
      done()

describe 'Facility', ->
  B = (major, minor, rssi = null)->
    uuid: '00000000-71C7-1001-B000-001C4D532518'
    major: major
    minor: minor
    rssi: rssi
  kanikama = new Kanikama()

  it 'Initial value is null', (done)->
    x = kanikama.currentFacility
    should.not.exist(x)
    done()

  it 'Set facility table', (done)->
    kanikama.facilities_ = [
      facility_id: 1
      name: 'FacilityA'
      beacons: [B(1, 1), B(1, 2)]
      floors: []
    ,
      facility_id: 2
      name: 'FacilityB'
      beacons: [B(2, 1), B(2, 2)]
      floors: []
    ]
    done()

  it 'Receive first beacons = A', (done)->
    kanikama.push [B(1, 1, -50)]
    kanikama.currentFacility.name.should.equal('FacilityA')
    done()

  it 'Receive unknown beacons', (done)->
    kanikama.currentFacility = null
    kanikama.buffer.clear()
    kanikama.push [B(100, 1, -50)]
    should.not.exist(kanikama.currentFacility)
    done()

  it 'A after B x 5 = A', (done)->
    for x in [0..10]
      kanikama.push [B(1, 1, -50)]
    for x in [0..2]
      kanikama.push [B(2, 1, -50)]
    kanikama.currentFacility.name.should.equal('FacilityA')
    done()

  it 'A after [A,B] x 10 = A', (done)->
    for x in [0..10]
      kanikama.push [B(1, 1, -50)]
    for x in [0..10]
      kanikama.push [B(2, 1, -50), B(1, 1, -100)]
    kanikama.currentFacility.name.should.equal('FacilityA')
    done()

  it 'A after B x 10 = B', (done)->
    for x in [0..10]
      kanikama.push [B(1, 1, -50)]
    for x in [0..10]
      kanikama.push [B(2, 1, -50)]
    kanikama.currentFacility.name.should.equal('FacilityB')
    done()

  it 'Benchmark less than 0.001ms', (done)->
    for x in [0..10]
      kanikama.push [B(2, 1, -50)]
    num = 1000000
    this.slow(0.001 * num);
    for i in [0..num]
      kanikama.updateFacility()
    done()

describe 'Floor', ->
  B = (major, minor, rssi = null)->
    uuid: '00000000-71C7-1001-B000-001C4D532518'
    major: major
    minor: minor
    rssi: rssi
  C = (minor, lat, lon)->
    uuid: '00000000-71C7-1001-B000-001C4D532518'
    major: 1
    minor: minor
    latitude: lat
    longitude: lon

  kanikama = new Kanikama()
  it 'Initial value is null', (done)->
    should.not.exist(kanikama.currentFloor)
    done()

  it 'Set facility table', (done)->
    kanikama.facilities_ = [
      facility_id: 1
      name: 'FacilityA'
      beacons: [B(1, 1), B(1, 2)]
      floors: [
        id: 1
        beacons: [C(1, 100, 50)]
      ,
        id: 2
        beacons: [C(1, 100, 50)]
      ]
    ]
    done()

  it 'Should getNearestFloor without facility is error', (done)->
    kanikama.currentFacility = null
    (-> kanikama.getNearestFloor(1)).should.throw()
    done()

  it 'Should select floor immediately if facility has one floor', (done)->
    kanikama = new Kanikama()
    kanikama.facilities_ = [
      facility_id: 1
      name: 'FacilityA'
      beacons: [B(1, 1), B(1, 2)]
      floors: [
        id: 1
      ]
    ]
    kanikama.push [B(1, 1, -50)]
    kanikama.currentFloor.id.should.equal(1)
    done()

  it 'Should select floor immediately if only one floor beacons', (done)->
    facilities_ = [
      facility_id: 1
      name: 'FacilityA'
      beacons: [B(1, 1), B(1, 2)]
      floors: [
        id: 1
        beacons: [C(1, 0, 0)]
      ,
        id: 2
        beacons: [C(2, 0, 0)]
      ]
    ]
    kanikama = new Kanikama()
    kanikama.facilities_ = facilities_
    kanikama.push [B(1, 1, -40)]
    kanikama.currentFloor.id.should.equal(1)
    kanikama = new Kanikama()
    kanikama.facilities_ = facilities_
    kanikama.push [B(1, 2, -20)]
    kanikama.currentFloor.id.should.equal(2)
    done()

  it 'Select floor from compare multiple floor\'s beacon', (done)->
    facilities_ = [
      facility_id: 1
      name: 'FacilityA'
      beacons: [B(1, 1), B(1, 2), B(1, 3), B(1, 4)]
      floors: [
        id: 1
        beacons: [C(1, 0, 0)]
      ,
        id: 2
        beacons: [C(2, 0, 0.00001), C(3, 0, 0.00002), C(4, 0, 0.00003)]
      ]
    ]
    kanikama = new Kanikama()
    kanikama.facilities_ = facilities_
    kanikama.push [B(1, 1, -10), B(1, 2, -60)]
    kanikama.push [B(1, 1, -20), B(1, 2, -60)]
    kanikama.push [B(1, 2, -30), B(1, 3, -60)]
    kanikama.push [B(1, 2, -40), B(1, 3, -60)]
    # kanikama.currentFloor.floor_id.should.equal(1)
    done()

  it 'Benchmark less than 0.001ms', (done)->
    for x in [0..10]
      kanikama.push [B(2, 1, -50)]
    num = 1000
    kanikama.push [B(1, 1, -20), B(1, 2, -60)]
    kanikama.push [B(1, 2, -30), B(1, 3, -60)]
    kanikama.push [B(1, 2, -40), B(1, 3, -60)]
    this.slow(0.001 * num);
    for i in [0..num]
      kanikama.updateFloor()
    done()

  it 'Should not change floor less than 5sec', (done)->
    kanikama.push [B(1, 1, -20), B(1, 2, -60)]
    kanikama.push [B(1, 2, -40), B(1, 3, -60)]
    kanikama.push [B(1, 2, -40), B(1, 3, -60)]
    kanikama.push [B(1, 2, -40), B(1, 3, -60)]
    kanikama.currentFloor.id.should.equal(1)
    done()

  it 'Should change floor over 5sec', (done)->
    kanikama.push [B(1, 1, -20), B(1, 2, -60)]
    kanikama.push [B(1, 2, -40), B(1, 3, -60)]
    kanikama.push [B(1, 2, -40), B(1, 3, -60)]
    kanikama.push [B(1, 2, -40), B(1, 3, -60)]
    this.slow(10000)
    this.timeout(10000);
    setTimeout(->
      kanikama.push [B(1, 2, -40), B(1, 3, -60)]
      kanikama.currentFloor.id.should.equal(2)
      done()
    , 5500);

describe 'Position', ->
  kanikama = new Kanikama()
  # Simulate Sabae City Library
  SB = (minor, rssi)->
    uuid: '00000000-71C7-1001-B000-001C4D532518'
    major: 105
    minor: minor
    rssi: rssi

  it 'Initial value is null', (done)->
    should.not.exist(kanikama.currentPosition)
    done()

  it 'Set facility table', (done)->
    fs = require("fs")
    kanikama.facilities_ = JSON.parse(fs.readFileSync("test/sabae.json", "utf8"))
    done()

  it 'No error with empty beacon data', (done)->
    kanikama.push([])
    done()

  it 'nearest1 x1', (done)->
    kanikama.push([SB(1, -10)])
    kanikama.currentPosition.latitude.should.equal(136.18638732106814)
    kanikama.currentPosition.algorithm.should.equal('nearest1')
    #console.log kanikama.currentPosition
    done()

  it 'nearest1 x2', (done)->
    kanikama.push([SB(1, -20), SB(2, -10)])
    kanikama.currentPosition.latitude.should.equal(136.18641004628117)
    kanikama.currentPosition.algorithm.should.equal('nearest1')
#    console.log kanikama.currentPosition
    done()

  it 'nearestD top (direction = 0, range = 90)', (done)->
    for heading in [315..359]
      kanikama.heading = heading
      kanikama.push([SB(39, -20)])
      kanikama.currentPosition.latitude.should.equal(136.18627059384187)
      kanikama.currentPosition.algorithm.should.equal('nearestD')
    for heading in [0..45]
      kanikama.heading = heading
      kanikama.push([SB(39, -20)])
      kanikama.currentPosition.latitude.should.equal(136.18627059384187)
      kanikama.currentPosition.algorithm.should.equal('nearestD')
#    console.log kanikama.currentPosition.direction
    done()

  it 'nearestD bottom (direction = 180, range = 90)', (done)->
    for heading in [135..225]
      kanikama.heading = heading
      kanikama.push([SB(39, -20)])
      kanikama.currentPosition.latitude.should.equal(136.18626991863806)
      kanikama.currentPosition.algorithm.should.equal('nearestD')
#    console.log kanikama.currentPosition.direction
    done()

  it 'nearest2 x1', (done)->
    kanikama.push([SB(133, -20), SB(116, -20)])
    kanikama.currentPosition.latitude.should.equal(136.1863696569712)
    kanikama.currentPosition.algorithm.should.equal('nearest2')
#    console.log kanikama.currentPosition
    done()

  it 'nearest2 x2', (done)->
    kanikama.push([SB(133, -20), SB(116, -20), SB(101, -30), SB(117, -30)])
    kanikama.currentPosition.latitude.should.equal(136.1863696569712)
    kanikama.currentPosition.algorithm.should.equal('nearest2')
    done()

  it 'nearest2 x2 filter near', (done)->
    kanikama.push([SB(133, -20), SB(116, -20), SB(101, -22), SB(117, -22)])
    kanikama.currentPosition.accuracy.should.equal(6)
    done()

  it 'if no beacon continue previous position', (done)->
    kanikama.push([SB(39, -20)])
    tmp = kanikama.currentPosition
    kanikama.push([])
    tmp.latitude.should.equal(kanikama.currentPosition.latitude)
    done()
