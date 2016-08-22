'use strict';

var Q = require('q');
var controller = require('./controller');

var router = {};

function wrapController(toExecute) {

    return Q.async(function* wrappedController(request, response) {

        try {

            yield toExecute.call(controller,request, response);

        } catch (e) {

            response.status(400).send({error: e.toString()});
            console.log(e.stack);

        }

    });

}

router.init = function (app) {

    app.get('/getMapObjects', wrapController(controller.getMapObjects));
    app.post('/walkToPoint', wrapController(controller.walkToPoint));
    app.get('/playerinfo', wrapController(controller.playerInfo));

};

module.exports = router;