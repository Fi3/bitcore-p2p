'use strict';

var chai = require('chai');
var Net = require('net');
var Socks5Client = require('socks5-client');

/* jshint unused: false */
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');
var fs = require('fs');

var bitcore = require('bitcore-lib');
var _ = bitcore.deps._;
var P2P = require('../');
var Peer = P2P.Peer;
var EventEmitter = require('events').EventEmitter;
var Messages = P2P.Messages;
var messages = new Messages();
var Networks = bitcore.Networks;
var Buffers = require('buffers');

describe('Peer', function() {

  var buildMessage = function(hex) {
    var m = Buffers();
    m.push(new Buffer(hex, 'hex'));
    return m;
  };

  describe('Integration test', function() {
    it('parses this stream of data from a connection', function(callback) {
      var peer = new Peer('');
      var stub = sinon.stub();
      var dataCallback;
      var connectCallback;
      var expected = {
        version: 1,
        verack: 1,
        inv: 18,
        addr: 4
      };
      var received = {
        version: 0,
        verack: 0,
        inv: 0,
        addr: 0
      };
      stub.on = function() {
        if (arguments[0] === 'data') {
          dataCallback = arguments[1];
        }
        if (arguments[0] === 'connect') {
          connectCallback = arguments[1];
        }
      };
      stub.write = function() {};
      stub.connect = function() {
        connectCallback();
      };
      peer._getSocket = function() {
        return stub;
      };
      peer.on('connect', function() {
        dataCallback(fs.readFileSync('./test/data/connection.log'));
      });
      var check = function(message) {
        received[message.command]++;
        if (_.isEqual(received, expected)) {
          callback();
        }
      };
      peer.on('version', check);
      peer.on('verack', check);
      peer.on('addr', check);
      peer.on('inv', check);
      peer.connect();
    });
  });

  it('create instance', function() {
    var peer = new Peer('localhost');
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(Networks.livenet.port);
  });

  it('create instance setting a port', function() {
    var peer = new Peer({host: 'localhost', port: 8111});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(8111);
  });

  it('create instance setting a network', function() {
    var peer = new Peer({host: 'localhost', network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(Networks.testnet.port);
  });

  it('create instance setting port and network', function() {
    var peer = new Peer({host: 'localhost', port: 8111, network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('create instance without new', function() {
    var peer = Peer({host: 'localhost', port: 8111, network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('set a proxy', function() {
    var peer, peer2, socket;

    peer = new Peer('localhost');
    expect(peer.proxy).to.be.undefined();
    socket = peer._getSocket();
    socket.should.be.instanceof(Net.Socket);

    peer2 = peer.setProxy('127.0.0.1', 9050);
    peer2.proxy.host.should.equal('127.0.0.1');
    peer2.proxy.port.should.equal(9050);
    socket = peer2._getSocket();
    socket.should.be.instanceof(Socks5Client);

    peer.should.equal(peer2);
  });

  it('send pong on ping', function(done) {
    var peer = new Peer({host: 'localhost'});
    var pingMessage = messages.Ping();
    peer.sendMessage = function(message) {
      message.command.should.equal('pong');
      message.nonce.should.equal(pingMessage.nonce);
      done();
    };
    peer.emit('ping', pingMessage);
  });

  it('send reject on invalid filter add', function(done) {
    var peer = new Peer({host: 'localhost'});
    var invalidFilter = 'f9beb4d966696c7465726c6f6164000063020000efdab15bfd' +
        '57020000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000100000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000400000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000020000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000';
    peer.sendMessage = function(message) {
      message.command.should.equal('reject');
      done();
    };
    peer.dataBuffer.push(new Buffer(invalidFilter, 'hex'));
    peer._readMessage();
  });

  it('send reject on unknown command', function(done) {
    var peer = new Peer({host: 'localhost'});
    var invalidCommand = 'f9beb4d96d616c6963696f757300000025000000bd5e830c' +
      '0102000000ec3995c1bf7269ff728818a65e53af00cbbee6b6eca8ac9ce7bc79d87' +
      '7041ed8';
    peer.sendMessage = function(message) {
      message.command.should.equal('reject');
      done();
    };
    peer.dataBuffer.push(new Buffer(invalidCommand, 'hex'));
    peer._readMessage();
  });

  it('send reject on malformed messages', function(done) {
    var peer = new Peer({host: 'localhost'});
    var malformed1 = 'd8c4c3d976657273696f6e000000000065000000fc970f177211' +
      '01000100000000000000ba628854000000000100000000000000000000000000000' +
      '00000ffffba8886dceab0010000000000000000000000000000000000ffff050955' +
      '22208de7e1c1ef80a1cea70f2f5361746f7368693a302e392e312fa317050001';
    peer.dataBuffer.push(new Buffer(malformed1, 'hex'));
    peer.sendMessage = function(message) {
      message.command.should.equal('reject');
      done();
    };
    peer._readMessage();
  });

  it('relay error from socket', function(done) {
    var peer = new Peer({host: 'localhost'});
    var socket = new EventEmitter();
    socket.connect = sinon.spy();
    socket.destroy = sinon.spy();
    peer._getSocket = function() {
      return socket;
    };
    var error = new Error('error');
    peer.on('error', function(err) {
      err.should.equal(error);
      done();
    });
    peer.connect();
    peer.socket.emit('error', error);
  });

  it('will not disconnect twice on disconnect and error', function(done) {
    var peer = new Peer({host: 'localhost'});
    var socket = new EventEmitter();
    socket.connect = sinon.stub();
    socket.destroy = sinon.stub();
    peer._getSocket = function() {
      return socket;
    };
    peer.on('error', sinon.stub());
    peer.connect();
    var called = 0;
    peer.on('disconnect', function() {
      called++;
      called.should.not.be.above(1);
      done();
    });
    peer.disconnect();
    peer.socket.emit('error', new Error('fake error'));
  });

  it('disconnect with max buffer length', function(done) {
    var peer = new Peer({host: 'localhost'});
    var socket = new EventEmitter();
    socket.connect = sinon.spy();
    peer._getSocket = function() {
      return socket;
    };
    peer.disconnect = function() {
      done();
    };
    peer.connect();
    var buffer = new Buffer(Array(Peer.MAX_RECEIVE_BUFFER + 1));
    peer.socket.emit('data', buffer);

  });

  it('should send version on version if not already sent', function(done) {
    var peer = new Peer({host:'localhost'});
    var commands = {};
    peer.sendMessage = function(message) {
      commands[message.command] = true;
      if (commands.verack && commands.version) {
        done();
      }
    };
    peer.socket = {};
    peer.emit('version', {
      version: 'version',
      subversion: 'subversion',
      startHeight: 'startHeight'
    });
  });

  it('should not send version on version if already sent', function(done) {
    var peer = new Peer({host:'localhost'});
    peer.versionSent = true;
    var commands = {};
    peer.sendMessage = function(message) {
      message.command.should.not.equal('version');
      done();
    };
    peer.socket = {};
    peer.emit('version', {
      version: 'version',
      subversion: 'subversion',
      startHeight: 'startHeight'
    });
  });

  it('relay set properly', function() {
    var peer = new Peer({host: 'localhost'});
    peer.relay.should.equal(true);
    var peer2 = new Peer({host: 'localhost', relay: false});
    peer2.relay.should.equal(false);
    var peer3 = new Peer({host: 'localhost', relay: true});
    peer3.relay.should.equal(true);
  });

  it('relay setting respected', function() {
    [true,false].forEach(function(relay) {
      var peer = new Peer({host: 'localhost', relay: relay});
      var peerSendMessageStub = sinon.stub(Peer.prototype, 'sendMessage', function(message) {
        message.relay.should.equal(relay);
      });
      peer._sendVersion();
      peerSendMessageStub.restore();
    });
  });

});
