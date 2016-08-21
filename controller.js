'use strict';

var Q = require('q');
var PokemonGo = require('pokemongo-api').default;

var username = process.env.PGO_USERNAME || 'user';
var password = process.env.PGO_PASSWORD || 'password';
var provider = process.env.PGO_PROVIDER || 'ptc';
var lat = process.env.LATITUDE || 48.140582785975916;
var lng = process.env.LONGITUDE || 11.590517163276672;
var pokemonGo = new PokemonGo();

var Controller = function () {

    this.pokemonGo = pokemonGo;

    this.pokemonGo.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    this.pokemonGo.login(username, password, provider);

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
        res.send({});
    }

    res.send({
        catchable: objects.wild_pokemons,
        nearby: objects.nearby_pokemons,
        spawn: objects.spawn_points,
        forts: objects.forts
    });

});

Controller.prototype.walk = Q.async(function*(req, res) {

    pokemonGo.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    yield pokemonGo.login(username, password, provider);

    let walking = yield pokemonGo.player.walkAround();

    res.send(walking);

});

Controller.prototype.playerInfo = Q.async(function*(req, res) {

    var pokemonGo = new PokemonGo();

    pokemonGo.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    yield pokemonGo.login(username, password, provider);

    res.send(pokemonGo.player);

});

module.exports = new Controller();