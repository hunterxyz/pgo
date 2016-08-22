'use strict';

require('babel-polyfill');
var Q = require('q');
var _ = require('lodash');
var PokemonGo = require('pokemongo-api').default;

var username = process.env.PGO_USERNAME || 'user';
var password = process.env.PGO_PASSWORD || 'password';
var provider = process.env.PGO_PROVIDER || 'ptc';
var lat = process.env.LATITUDE || 48.140582785975916;
var lng = process.env.LONGITUDE || 11.590517163276672;
var pokemonGo = new PokemonGo();

function deg2rad(deg) {
    return deg * (Math.PI / 180)
};

var getDistance = function (lat1, lon1, lat2, lon2) {
    var earthRadius = 6371 * 1000; // Radius of the earth in meters
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var distance = earthRadius * c; // Distance in km

    return distance;

};

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

    // let walking = yield pokemonGo.player.walkToPoint(lat, lng);

    var distance = getDistance(pokemonGo.player.location.latitude, pokemonGo.player.location.longitude, lat, lng);
    res.send({distance: distance});

});

Controller.prototype.playerInfo = Q.async(function*(req, res) {

    res.send(pokemonGo.player);

});

module.exports = new Controller();