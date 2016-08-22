'use strict';

const express = require('express');
const http = require('http');
var router = require('./router');
var bodyParser = require('body-parser');
var serveStatic = require('serve-static');

const app = express();

app.use(bodyParser.json());
app.use(serveStatic('./public'));
app.set('port', 5050);
router.init(app);

const server = http.createServer(app);

server.listen(app.get('port'), function () {
    console.log('Started HTTP server on ' + app.get('port'));
});