var gulp = require('gulp');
var coffee = require('gulp-coffee');
var exec = require('child_process').exec;
var mocha = require('gulp-mocha');

gulp.task('default', ['watch']);

gulp.task('test', ['coverage'],function () {
    return gulp.src('test/test.js', {read: false})
        .pipe(mocha());
});

gulp.task('coverage',function () {
    return exec('mocha -R html-cov > coverage.html', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
    });
});

gulp.task('watch', function(){
    return gulp.watch(['./kanikama.js','./test/test.js'], ['test']);
});
