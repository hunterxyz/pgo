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

        app.post('/walkToPoint', wrapController(controller.walkToPoint));
        app.post('/moveto', wrapController(controller.moveTo));
        app.post('/player/login', wrapController(controller.playerLogin));
        app.post('/player/logout', wrapController(controller.playerLogout));
        app.post('/player/lootpokestop', wrapController(controller.lootPokestop));
        app.post('/player/catchpokemon', wrapController(controller.catchPokemon));
        app.post('/player/recycle', wrapController(controller.recycleRoute));
        app.post('/player/transfer', wrapController(controller.transferRoute));
        app.post('/player/evolve', wrapController(controller.evolveRoute));

        app.get('/amilogged/:user',wrapController(controller.amILoggedRoute));

        controller.initSocketIOListeners();

    });

};

module.exports = router;