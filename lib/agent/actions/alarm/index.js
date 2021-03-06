"use strict";

//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs      = require('fs'),
    path    = require('path'),
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    Emitter = require('events').EventEmitter,
    system  = require('./../../common').system,
    child;

exports.start = function(options, callback){

  var error,
      self    = this;

  var options = options || {};
  var type    = options.file || options.sound || 'alarm';
  var file    = type + '.mp3';
  var loops   = options.loops || 1;

  var done = function() {
    callback(error);
  }

  var play_queue = function(){
    loops--;

    system.spawn_as_logged_user(os_functions.command, [ file ], function(err, child){
      if (err) return done(err);

      child.on('error', function(err) {
        error = err;
      })

      child.once('exit', function(code){
        if (loops === 0) return;
        play_queue();
      })
    });

  };

  fs.exists(file, function(exists) {
    if (!exists) file = path.join(__dirname, 'lib', file);
    play_queue();
  });

  setTimeout(done, 1000);
};

exports.stop = function(){

  if (child && !child.exitCode)
    child.kill();
}
