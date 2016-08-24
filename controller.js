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
var PokemonGo = require('pokemongo-api').default;
var geoHelper = require('./utils/GeoHelper');

var username = process.env.PGO_USERNAME || 'user';
var password = process.env.PGO_PASSWORD || 'password';
var provider = process.env.PGO_PROVIDER || 'ptc';
var lat = process.env.LATITUDE || 48.140582785975916;
var lng = process.env.longitude || 11.590517163276672;
var pokemonGo = new PokemonGo();

var Controller = function () {

    this.pokemonGo = pokemonGo;

    this.login();

};

Controller.prototype.login = function () {

    this.pokemonGo.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    return this.pokemonGo.login(username, password, provider);

};

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
    }

    res.send({
        catchable: objects.wild_pokemons,
        nearby: objects.nearby_pokemons,
        spawn: objects.spawn_points,
        forts: objects.forts
    });

});

Controller.prototype.walkToPoint = Q.async(function*(req, res) {

    let lat = req.body.lat;
    let lng = req.body.lng;
    let kmPerHour = req.body.kmh || 50;
    let coordinates = [];

    // let walking = yield pokemonGo.player.walkToPoint(lat, lng);

    var latStart = this.pokemonGo.player.location.latitude;
    var lngStart = this.pokemonGo.player.location.longitude;
    var distance = geoHelper.getDistance(latStart, lngStart, lat, lng);

    var metersPerSecond = geoHelper.kmh2ms(kmPerHour);
    var seconds = distance / metersPerSecond;
    var timer = 0;

    while (timer < seconds) {

        timer++;
        var distanceToReach = metersPerSecond;

        if (timer > seconds) {
            distanceToReach = distance % metersPerSecond;
        }

        var bearing = geoHelper.getBearing(latStart, lngStart, lat, lng);
        var newCoordinates = geoHelper.getDestinationPoint(latStart, lngStart, distanceToReach, bearing);

        coordinates.push(newCoordinates);

        latStart = newCoordinates.lat;
        lngStart = newCoordinates.lng;

    }

    res.send({distance: distance, bearing: bearing, coordinates: coordinates});

});

Controller.prototype.playerInfo = Q.async(function*(req, res) {

    res.send(pokemonGo.player);

});

module.exports = new Controller();