/**
 * ES2015移行スクリプト
 *
 * Created by sakai@calil.jp on 2016/09/24.
 */
var decaf = require('decafjs');
var fs = require('fs');

var raw = fs.readFileSync('kanikama.coffee').toString();
var es2015 = decaf.compile(raw);
fs.writeFileSync('kanikama.js', es2015);
