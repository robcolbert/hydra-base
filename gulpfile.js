// gulpfile.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const gulp = require('gulp');
const nodemon = require('gulp-nodemon');
const plumber = require('gulp-plumber');
const livereload = require('gulp-livereload');
const less = require('gulp-less');

gulp.task('less', () => {
  gulp
  .src('./public/css/*.less')
  .pipe(plumber())
  .pipe(less())
  .pipe(gulp.dest('./public/css'))
  .pipe(livereload());
});

gulp.task('watch', () => {
  var files = [
    './public/css/**/*.less',
    './public/css/hydra/*.less'
  ];
  gulp.watch(files, ['less']);
});

gulp.task('develop', () => {
  livereload.listen();
  nodemon({
    script: 'hydra.js',
    ext: 'js coffee pug',
    stdout: false
  }).on('readable', function () {
    this.stdout.on('data', (chunk) => {
      if (/HYDRA application node online/.test(chunk)) {
        livereload.changed(__dirname);
      }
    });
    this.stdout.pipe(process.stdout);
    this.stderr.pipe(process.stderr);
  });
});

gulp.task('default', [
  'less',
  'develop',
  'watch'
]);