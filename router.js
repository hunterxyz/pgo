'use strict';

var Q = require('q');
var controller = require('./controller');

var router = {};

function wrapController(toExecute) {

    return Q.async(function* wrappedController(request, response) {

        try {

            yield toExecute.call(controller, request, response);

        } catch (e) {

            response.status(400).send({error: e.toString()});
            console.log(e.stack);

        }

    });

}

router.init = function (app) {

    io.on('connection', function (socket) {

        controller.setSocket(socket);

        app.get('/getMapObjects', wrapController(controller.getMapObjects));
        app.post('/walkToPoint', wrapController(controller.walkToPoint));
        app.get('/playerinfo', wrapController(controller.playerInfo));

        app.post('/player/login', wrapController(controller.playerLogin));

        controller.initSocketIOListeners();

        socket.on('hello', function (data) {
            socket.emit('hello', {message: 'hello'});
        });

    });

};

module.exports = router;