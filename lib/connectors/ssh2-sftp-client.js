/**
 * ssh2 sftp client for node
 * https://github.com/jyu213/ssh2-sftp-client
 */
'use strict';

var inherits = require('util').inherits,
    EventEmitter = require('events').EventEmitter;

let Client = require('ssh2').Client;

let SftpClient = function(){
    this.client = new Client();
    this.setMaxListeners(0);
};

inherits(SftpClient, EventEmitter);

/**
 * Retrieves a directory listing
 *
 * @param {String} path, a string containing the path to a directory
 * @return {Promise} data, list info
 */
SftpClient.prototype.list = function(path) {
    let reg = /-/gi;

    return new Promise((resolve, reject) => {
        let sftp = this.sftp;

        if (sftp) {
            sftp.readdir(path, (err, list) => {
                if (err) {
                    this.emit('error', err);
                    reject(err);
                    return false;
                }
                // reset file info
                list.forEach((item, i) => {
                    list[i] = {
                        type: item.longname.substr(0, 1),
                        name: item.filename,
                        size: item.attrs.size,
                        modifyTime: item.attrs.mtime * 1000,
                        accessTime: item.attrs.atime * 1000,
                        rights: {
                            user: item.longname.substr(1, 3).replace(reg, ''),
                            group: item.longname.substr(4,3).replace(reg, ''),
                            other: item.longname.substr(7, 3).replace(reg, '')
                        },
                        owner: item.attrs.uid,
                        group: item.attrs.gid
                    }
                });
                resolve(list);
            });
        } else {
            this.emit('error', 'sftp connect error');
            reject('sftp connect error');
        }
    });
};

/**
 * get file
 *
 * @param {String} path, path
 * @param {Object} useCompression, config options
 * @param {String} encoding. Encoding for the ReadStream, can be any value supported by node streams. Use 'null' for binary (https://nodejs.org/api/stream.html#stream_readable_setencoding_encoding)
 * @return {Promise} stream, readable stream
 */
SftpClient.prototype.get = function(path, useCompression, encoding) {
    let options = this.getOptions(useCompression, encoding)

    return new Promise((resolve, reject) => {
        let sftp = this.sftp;

        if (sftp) {
            try {
                let stream = sftp.createReadStream(path, options);

                stream.on('error', function(err) {
                    this.emit('error', err);
                    reject;
                });

                resolve(stream);
            } catch(err) {
                this.emit('error', err);
                reject(err);
            }
        } else {
            this.emit('error', 'sftp connect error');
            reject('sftp connect error');
        }
    });
};

/**
 * Create file
 *
 * @param  {String|Buffer|stream} input
 * @param  {String} remotePath,
 * @param  {Object} useCompression [description]
 * @param  {String} encoding. Encoding for the WriteStream, can be any value supported by node streams.
 * @return {[type]}                [description]
 */
SftpClient.prototype.put = function(input, remotePath, useCompression, encoding) {
    let options = this.getOptions(useCompression, encoding)

    return new Promise((resolve, reject) => {
        let sftp = this.sftp;

        if (sftp) {
            if (typeof input === 'string') {
                sftp.fastPut(input, remotePath, options, (err) => {
                    if (err) {
                        this.emit('error', err);
                        reject(err);
                        return false;
                    }
                    resolve();
                });
                return false;
            }
            let stream = sftp.createWriteStream(remotePath, options);
            let data;

            stream.on('error', reject);
            stream.on('close', resolve);

            let written = 0;
            const timer = setInterval(() => {
              if (!stream) return;
              written = stream.bytesWritten;
              this.emit('data', written);
            }, 250);

            if (input instanceof Buffer) {
                data = stream.end(input);
                if (timer) clearInterval(timer);
                return false;
            }
            data = input.pipe(stream);
        } else {
            this.emit('error', 'sftp connect error');
            reject('sftp connect error');
        }
    });
};

SftpClient.prototype.mkdir = function(path, recursive) {
    recursive = recursive || false;

    return new Promise((resolve, reject) => {
        let sftp = this.sftp;

        if (sftp) {
            if (!recursive) {
                sftp.mkdir(path, (err) => {
                    if (err) {
                        this.emit('error', err);
                        reject(err);
                        return false;
                    }
                    resolve();
                });
                return false;
            }

            let tokens = path.split(/\//g);
            let p = '';

            let mkdir = () => {
                let token = tokens.shift();

                if (!token && !tokens.length) {
                    resolve();
                    return false;
                }
                token += '/';
                p = p + token;
                sftp.mkdir(p, (err) => {
                    if (err && err.code !== 4) {
                        this.emit('error', err);
                        reject(err);
                    }
                    mkdir();
                });
            };
            return mkdir();
        } else {
            this.emit('error', 'sftp connect error');
            reject('sftp connect error');
        }
    });
};

SftpClient.prototype.rmdir = function(path, recursive) {
    recursive = recursive || false;

    return new Promise((resolve, reject) => {
        let sftp = this.sftp;

        if (sftp) {
            if (!recursive) {
                return sftp.rmdir(path, (err) => {
                    if (err) {
                        this.emit('error', err);
                        reject(err);
                    }
                    resolve();
                });
            }
            let rmdir = (p) => {
                return this.list(p).then((list) => {
                    if (list.length > 0) {
                        let promises = [];

                        list.forEach((item) => {
                            let name = item.name;
                            let promise;
                            var subPath;

                            if (name[0] === '/') {
                                subPath = name;
                            } else {
                                if (p[p.length - 1] === '/') {
                                    subPath = p + name;
                                } else {
                                    subPath = p + '/' + name;
                                }
                            }

                            if (item.type === 'd') {
                                if (name !== '.' || name !== '..') {
                                    promise = rmdir(subPath);
                                }
                            } else {
                                promise = this.delete(subPath);
                            }
                            promises.push(promise);
                        });
                        if (promises.length) {
                            return Promise.all(promises).then(() => {
                                return rmdir(p);
                            });
                        }
                    } else {
                        return new Promise((resolve, reject) => {
                            return sftp.rmdir(p, (err) => {
                                if (err) {
                                    this.emit('error', err);
                                    reject(err);
                                }
                                else {
                                    resolve();
                                }
                            });
                        });
                    }
                });
            };
            return rmdir(path).then(() => {resolve()})
                        .catch((err) => {this.emit('error', err);reject(err)});
        } else {
            this.emit('error', 'sftp connect error');
            reject('sftp connect error');
        }
    });
};

SftpClient.prototype.delete = function(path) {
    return new Promise((resolve, reject) => {
        let sftp = this.sftp;

        if (sftp) {
            sftp.unlink(path, (err) => {
                if (err) {
                    this.emit('error', err);
                    reject(err);
                    return false;
                }
                resolve();
            });
        } else {
            this.emit('error', 'sftp connect error');
            reject('sftp connect error');
        }
    });
};

SftpClient.prototype.rename = function(srcPath, remotePath) {
    return new Promise((resolve, reject) => {
        let sftp = this.sftp;

        if (sftp) {
            sftp.rename(srcPath, remotePath, (err) => {
                if (err) {
                    this.emit('error', err);
                    reject(err);
                    return false;
                }
                resolve();
            });
        } else {
            this.emit('error', 'sftp connect error');
            reject('sftp connect error');
        }
    });
}

SftpClient.prototype.connect = function(config) {
    var c = this.client;

    return new Promise((resolve, reject) => {
        try {
          this.client.on('ready', () => {

              this.client.sftp((err, sftp) => {
                  if (err) {
                      this.emit('error', err);
                      reject(err);
                  }
                  this.sftp = sftp;
                  this.emit('ready');
                  resolve(sftp);
              });
          }).on('error', (err) => {
              this.emit('error', err);
              reject(err);
          }).connect(config);
        } catch(err) {
            this.emit('error', err);
            reject(err);
        }
    });
};

SftpClient.prototype.end = function() {
    return new Promise((resolve) => {
        this.client.end();
        this.emit('end');
        resolve();
    });
};

SftpClient.prototype.getOptions = function(useCompression, encoding){
    if(encoding === undefined){
        encoding = 'utf8';
    }
    let options = Object.assign({}, {encoding: encoding}, useCompression);
    return options;
};

module.exports = SftpClient;
