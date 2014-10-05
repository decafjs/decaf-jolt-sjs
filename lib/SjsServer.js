/** @module jolt */

/*global require, exports, __dirname, sync */

"use strict";

var File = require('File'),
    Semaphore = require('Threads').Semaphore;

function getSjs(me, path) {
    me.semaphore.lock();
    try {
        var cache = me.cache,
            file;

        var sjs = cache[path];
        if (!sjs) {
            file = new File(path);
            if (file.isDirectory()) {
                file = new File(path + '/index.sjs');
                if (!file.exists()) {
                    return 403;
                }
            }
            if (!file.exists()) {
                return 404;
            }
            cache[path] = sjs = {
                file         : file,
                lastModified : 0
            };
        }
        else {
            file = sjs.file;
        }
        var lastModified = file.lastModified();
        if (lastModified > sjs.lastModified) {
            sjs.fn = new Function('me', 'req', 'res', file.readAll());
            sjs.lastModified = lastModified;
        }
        return sjs;
    }
    finally {
        me.semaphore.unlock();
    }
}
function runSjs(me, req, res) {
    var sjs = getSjs(me, me.path + '/' + req.args.join('/'));
    if (!sjs.fn) {
        return sjs;
    }
    return sjs.fn.call(req.scope, me, req, res) || 200;
}

/**
 * Serve SJS files from a directory structure on disk.
 *
 * SJS files are compiled once and then called over and over, but if the
 * file is changed on disk, it will be recompiled.  This caching provides
 * some boost in performance.
 *
 * @constructor
 * @param {string} path directory to serve .sjs files from
 * @returns {Object} config suitable for use with Application.verb()
 */
function SjsServer(path) {
    var ret = {
        path      : path,
        semaphore : new Semaphore(),
        cache     : {},
        handler   : function(me, req, res) {
            return runSjs(me, req, res);
        }
    };

    return ret;
}

decaf.extend(SjsServer.prototype, {

});

function SjsFile(path, args) {
    var file = new File(path);
    if (!file.exists()) {
        throw new Error('SjsFile ' + path + ' does not exist');
    }
    if (!file.isFile()) {
        throw new Error('SjsFile ' + path + ' is not a file');
    }
    return {
        path         : path,
        args         : args,
        file         : file,
        lastModified : 0,
        fn           : function() {
        },
        handler      : function(me, req, res) {
            var modified = file.lastModified();
            if (modified > me.lastModified) {
                me.fn = new Function('me', 'req', 'res', file.readAll());
                me.lastModified = modified;
            }
            return me.fn.call(req.scope, me, req, res) || 200;
        }
    };
}

decaf.extend(exports, {
    SjsServer : SjsServer,
    SjsFile   : SjsFile
});
