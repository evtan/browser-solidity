'use strict'
var async = require('async')
var EventManager = require('ethereum-remix').lib.EventManager

class SystemFiles {
  constructor (remixd) {
    this.event = new EventManager()
    this.remixd = remixd
    this.files = null
    this.filesTree = null
  }

  init (cb) {
    this.remixd.call('systemfiles', 'list', {}, (error, filesList) => {
      if (error) {
        console.log(error)
        cb(error)
      } else {
        this.files = filesList
        listAsTree(this, filesList, (error, tree) => {
          this.filesTree = tree
          cb(error)
        })
      }
    })
  }

  exists (path) {
    if (!this.files) return false
    return this.files[path] !== undefined
  }

  get (path, cb) {
    this.remixd.call('systemfiles', 'get', {path: path}, (error, result) => {
      cb(error, result)
    })
  }

  set (path, content, cb) {
    this.files[path] = content
    this.remixd.call('systemfiles', 'set', {path: path, content: content}, (error, result) => {
      if (cb) cb(error, result)
    })
    return true
  }

  addReadOnly (path, content) {
    return false
  }

  isReadOnly (path) {
    return false
  }

  remove (path) {
    delete this.files[path]
    this.filesTree = listAsTree(this.files)
    this.remixd.call('systemfiles', 'remove', {path: path}, (error, result) => {
      console.log(error, result)
    })
  }

  rename (oldPath, newPath) {
    this.files[newPath] = this.files[oldPath]
    delete this.files[oldPath]
    this.filesTree = listAsTree(this.files)
    this.remixd.call('systemfiles', 'rename', {oldPath: oldPath, newPath: newPath}, (error, result) => {
      console.log(error, result)
    })
    return true
  }

  list () {
    return this.files
  }

  listAsTree () {
    return this.filesTree
  }
}

//
// Tree model for files
// {
//   'a': { }, // empty directory 'a'
//   'b': {
//     'c': {}, // empty directory 'b/c'
//     'd': { '/readonly': true, '/content': 'Hello World' } // files 'b/c/d'
//     'e': { '/readonly': false, '/path': 'b/c/d' } // symlink to 'b/c/d'
//     'f': { '/readonly': false, '/content': '<executable>', '/mode': 0755 }
//   }
// }
//
function listAsTree (self, filesList, callback) {
  function hashmapize (obj, path, val) {
    var nodes = path.split('/')
    var i = 0

    for (; i < nodes.length - 1; i++) {
      var node = nodes[i]
      if (obj[node] === undefined) {
        obj[node] = {}
      }
      obj = obj[node]
    }

    obj[nodes[i]] = val
  }

  var tree = {}

  // This does not include '.remix.config', because it is filtered
  // inside list().
  async.eachSeries(Object.keys(filesList), function (path, cb) {
    self.get(path, (error, content) => {
      if (error) {
        console.log(error)
        cb(error)
      } else {
        hashmapize(tree, path, {
          '/readonly': false,
          '/content': content
        })
        cb()
      }
    })
  }, (error) => {
    callback(error, tree)
  })
}

module.exports = SystemFiles
