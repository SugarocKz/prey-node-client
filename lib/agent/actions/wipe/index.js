var join    = require('path').join,
    Emitter = require('events').EventEmitter,
    wipe    = require('./wipe'),
    common  = require('./../../common'),
    logger  = common.logger.prefix('wipe'),
    system  = common.system;

var emitter,
    child;

var node_bin = join(system.paths.current, 'bin', 'node');

if (common.os_name == 'windows')
  node_bin = node_bin + '.exe';

var valid_types = function(hash) {
  var list = [];

  // hash keys should be 'wipe_cookies', 'wipe_passwords', etc
  for (var key in hash) {
    if (hash[key].trim() == 'on') {
      var method = key.replace('wipe_', ''); // just 'cookies'
      if (typeof wipe[method] == 'function')
        list.push(method);
    }
  }

  return list;
}

exports.start = function(opts, cb) {

  var opts    = opts || {};
  var confirm = opts.confirm == 'ireallyknowwhatiamdoing';
  var items   = valid_types(opts);

  // if (!confirm)
  //   return cb(new Error('Invalid confirmation string.'))

  if (items.length == 0)
    return cb(new Error('Nothing to wipe!'))

  logger.warn('WIPING ' + items.join(', '));

  var last_err;
  var queued  = 0,
      removed = 0;

  // runs it within this context, unlike the spawn option
  var queue = function(method) {
    queued++;
    wipe[method](function(err, removed){
      if (err) last_err = err;
      removed += removed;
      --queued || finished(last_err);
    })
  }

  // run it as another process, using impersonation (to avoid permission errors)
  var spawn = function() {
    var args = [join(__dirname, 'runner.js')].concat(items);

    system.spawn_as_logged_user(node_bin, args, function(err, child) {
      child.stdout.on('data', function(str) {
        var lines = str.toString().split("\n");
        lines.forEach(function(line) {
          if (line.toString().match('Removing file')) {
            logger.warn(str.toString());
            removed++;
          }
        });
      })
      child.on('exit', function(code) {
        if (code != 0) last_err = new Error('Command failed.');
        finished();
      });
    });
  }

  var finished = function(err) {
    emitter && emitter.emit('end', err, { files_removed: removed });
  }

  emitter = new Emitter;
  cb(null, emitter);
  spawn();

}

exports.stop = function(){
  if (child) // spawn method
    child.stop();
  else
    wipe.stop();

  emitter = null;
}
