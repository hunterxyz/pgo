'use strict';

const express = require('express');
const http = require('http');
var router = require('./router');
var bodyParser = require('body-parser');
var serveStatic = require('serve-static');
var socketio = require('socket.io');
var cors = require('cors');

var corsOptions = {
    origin: '*',
    exposedHeaders: ['totalItems'],
    methods: ['GET', 'PUT', 'POST', 'DELETE']
};

const app = express();

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(serveStatic('./public'));
app.set('port', 5050);


const server = http.createServer(app);
global.io = socketio.listen(server);
global.socket = null;

io.set('origins', '*localhost:5050');

router.init(app);

server.listen(app.get('port'), function () {
    console.log('Started HTTP server on ' + app.get('port'));
});