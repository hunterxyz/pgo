'use strict';

if (Number.prototype.toRadians === undefined) {
    Number.prototype.toRadians = function () {
        return this * Math.PI / 180;
    };
}

/** Extend Number object with method to convert radians to numeric (signed) degrees */
if (Number.prototype.toDegrees === undefined) {
    Number.prototype.toDegrees = function () {
        return this * 180 / Math.PI;
    };
}

require('babel-polyfill');
var Q = require('q');
var _ = require('lodash');
var XDate = require('xdate');
var PokemonGo = require('pokemongo-api').default;
var geoHelper = require('./utils/GeoHelper');

var username = process.env.PGO_USERNAME || 'user';
var password = process.env.PGO_PASSWORD || 'password';
var provider = process.env.PGO_PROVIDER || 'ptc';
var lat = process.env.LATITUDE || 48.140582785975916;
var lng = process.env.LONGITUDE || 11.590517163276672;
var pokemonGo = new PokemonGo();
var externalPlayer = new PokemonGo();

var Controller = function () {

    this.walkingInterval = null;
    this.lastTimeMapCall = 0;
    this.pokemonGo = pokemonGo;
    this.externalPlayer = externalPlayer;
    this.lastMapObjects = {};
    this.login();

};

var parseMapResponse = function (objects) {

    return {
        catchable: objects.wild_pokemons,
        nearby: objects.nearby_pokemons,
        spawn: objects.spawn_points,
        forts: objects.forts
    };
};

Controller.prototype.login = function () {

    this.pokemonGo.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    return this.pokemonGo.login(username, password, provider);

};

Controller.prototype.playerLogin = Q.async(function* (req, res) {

    var lat = req.body.lat;
    var lng = req.body.lng;
    var username = req.body.username;
    var password = req.body.password;
    var provider = req.body.provider || 'ptc';

    this.externalPlayer.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    var player = yield this.externalPlayer.login(username, password, provider);

    res.send(player.inventory);

});

Controller.prototype.getMapObjects = Q.async(function*(req, res) {

    lat = req.query.lat || lat;
    lng = req.query.lng || lng;

    var objects = [];

    this.pokemonGo.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    try {

        objects = yield this.pokemonGo.GetMapObjects();
        this.lastTimeMapCall = new XDate();

    } catch (error) {

        console.log(error);
        if (error.message === 'Illegal buffer') {

            this.pokemonGo = new PokemonGo();

            yield this.login();

            yield this.getMapObjects(req, res);

        }

    }

    if (objects.forts.checkpoints.length === 0) {
        res.status(500).send({});
    } else {
        this.socket.emit('populateMap', parseMapResponse(objects, {lat: lat, lng: lng}));
    }

    res.send({});

});

Controller.prototype.walkToPoint = Q.async(function*(req, res) {

    var self = this;
    let lat = req.body.lat;
    let lng = req.body.lng;
    let kmPerHour = req.body.kmh || 50;
    let stepFrequency = req.body.stepFrequency || 1; //seconds

    var latStart = this.pokemonGo.player.location.latitude;
    var lngStart = this.pokemonGo.player.location.longitude;
    var distance = geoHelper.getDistance(latStart, lngStart, lat, lng);

    var metersPerSecond = geoHelper.kmh2ms(kmPerHour);
    var seconds = distance / metersPerSecond;
    var timer = 0;

    if (this.walkingInterval) {
        clearInterval(this.walkingInterval);
    }

    var walkToNextpoint = function () {

        timer = timer + stepFrequency;

        var isLastStep = false;
        var distanceToReach = metersPerSecond * stepFrequency;

        if (timer > seconds) {
            distanceToReach = distance % (metersPerSecond * stepFrequency);
            clearInterval(self.walkingInterval);
            isLastStep = true;
        }

        var bearing = geoHelper.getBearing(latStart, lngStart, lat, lng);
        var newCoordinates = geoHelper.getDestinationPoint(latStart, lngStart, distanceToReach, bearing);
        newCoordinates.isLastStep = isLastStep;

        latStart = newCoordinates.lat;
        lngStart = newCoordinates.lng;

        self.pokemonGo.player.location = {
            latitude: newCoordinates.lat,
            longitude: newCoordinates.lng
        };

        self.socket.emit('walkedTo', newCoordinates);

        if (self.lastTimeMapCall === 0) {
            self.lastTimeMapCall = new XDate().addSeconds(-15);
        }

        if (self.lastTimeMapCall && self.lastTimeMapCall.diffSeconds(new XDate()) >= 10) {

            var coordinatesToSend = JSON.parse(JSON.stringify(newCoordinates));

            self.lastTimeMapCall = new XDate();

            self.pokemonGo.GetMapObjects().then(function (response) {

                if (response.forts.checkpoints.length) {
                    self.socket.emit('populateMap', parseMapResponse(response, coordinatesToSend));
                }

            })
        }

    };

    walkToNextpoint();
    this.walkingInterval = setInterval(walkToNextpoint, 1000 * stepFrequency);

    res.send({distance: distance});

})
;

Controller.prototype.playerInfo = Q.async(function*(req, res) {

    res.send(pokemonGo.player);

});

Controller.prototype.setSocket = function (socket) {

    this.socket = socket;

};

Controller.prototype.initSocketIOListeners = function () {

    var self = this;

    self.socket.on('stopWalking', function () {
        if (self.walkingInterval) {
            clearInterval(self.walkingInterval);
        }
    });

};

module.exports = new Controller();