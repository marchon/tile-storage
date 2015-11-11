'use strict';
window.offlineMaps = {};
window.offlineMaps.eventManager = {
  _events: {},
  on: function (event, action) {
    //console.log('event.on: ' + event);
    if (!(event in this._events)) {
      this._events[event] = [];
    }
    this._events[event].push(action);
    return this;
  },
  off: function (event) {
    //console.log('event.off: ' + event);
    delete this._events[event];
    return this;
  },
  fire: function (event) {
    //console.log('event.fire: ' + event);
    var events = this._events;
    if (event in events) {
      var actions = events[event];
      var args = Array.prototype.slice.call(arguments, 1);
      for (var i = 0, l = actions.length; i < l; i++) {
        var action = actions[i];
        if (action instanceof Function) {
          action.apply(null, args);
        } else {
          this.fire.apply(this, [action].concat(args));
        }
      }
    }
    return this;
  }
};
(function (window, emr, undefined) {
  var getIndexedDBStorage = function () {
    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    var IndexedDBImpl = function () {
      var self = this;
      var db = null;
      var request = indexedDB.open('TileStorage');
      request.onsuccess = function () {
        db = this.result;
        emr.fire('storageLoaded', self);
      };
      request.onerror = function (error) {
        console.log(error);
      };
      request.onupgradeneeded = function () {
        var store = this.result.createObjectStore('tile', { keyPath: 'key' });
        store.createIndex('key', 'key', { unique: true });
      };
      this.add = function (key, value) {
        console.log('adding tile');
        var transaction = db.transaction(['tile'], 'readwrite');
        var objectStore = transaction.objectStore('tile');
        objectStore.put({
          key: key,
          value: value
        });
      };
      this.delete = function (key) {
        console.log('delete tile');
        var transaction = db.transaction(['tile'], 'readwrite');
        var objectStore = transaction.objectStore('tile');
        objectStore.delete(key);
      };
      this.get = function (key, successCallback, errorCallback) {
        var transaction = db.transaction(['tile'], 'readonly');
        var objectStore = transaction.objectStore('tile');
        var result = objectStore.get(key);
        result.onsuccess = function () {
          successCallback(this.result ? this.result.value : undefined);
        };
        result.onerror = errorCallback;
      };
    };
    return indexedDB ? new IndexedDBImpl() : null;
  };
  var getWebSqlStorage = function () {
    var openDatabase = window.openDatabase;
    var WebSqlImpl = function () {
      var self = this;
      var db = openDatabase('TileStorage', '1.0', 'Tile Storage', 5 * 1024 * 1024);
      db.transaction(function (tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS tile (key TEXT PRIMARY KEY, value TEXT)', [], function () {
          emr.fire('storageLoaded', self);
        });
      });
      this.add = function (key, value) {
        db.transaction(function (tx) {
          tx.executeSql('INSERT INTO tile (key, value) VALUES (?, ?)', [
            key,
            value
          ]);
        });
      };
      this.delete = function (key) {
        db.transaction(function (tx) {
          tx.executeSql('DELETE FROM tile WHERE key = ?', [key]);
        });
      };
      this.get = function (key, successCallback, errorCallback) {
        db.transaction(function (tx) {
          tx.executeSql('SELECT value FROM tile WHERE key = ?', [key], function (tx, result) {
            successCallback(result.rows.length ? result.rows.item(0).value : undefined);
          }, errorCallback);
        });
      };
    };
    return openDatabase ? new WebSqlImpl() : null;
  };
  emr.on('storageLoad', function () {
    var storage = getIndexedDBStorage() || getWebSqlStorage() || null;
    if (!storage) {
      emr.fire('storageLoaded', null);
    }
  });
}(window, window.offlineMaps.eventManager));
Polymer({
  is: 'tile-storage',
  properties: {
    /**
     * Fired when underlying storage (websql or indexeddb) is ready
     *
     * @event storage-ready
     * @type CustomEvent
     * @param {storage} storage The storage api
     */
    /**
     * reference to the storage api, either web sql or indexeddb
     * Sets up the api and data structure for offline tiles
     *
     * @property storage
     * @type Object
     * @default undefined
     */
    storage: {
      value: function () {
        return undefined;
      },
      notify: true
    }
  },
  created: function () {
    var self = this;
    (function (emr) {
      emr.on('storageLoaded', 'storageReady');
      emr.fire('storageLoad');
      emr.on('storageReady', function (storage) {
        self.storage = storage;
        self.fire('storage-ready', { 'storage': storage });
      });
    }(window.offlineMaps.eventManager));
  }
});
