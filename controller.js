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

function waitMs(time) {
    return new Promise((resolve) => { // dont use reject
        setTimeout(()=> {
            resolve()
        }, time)
    })
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
    this.lastTimePlayerMapCall = 0;
    this.pokemonGo = pokemonGo;
    this.externalPlayer = externalPlayer;
    this.login(lat, lng);

    this.playerUsername = 'user';
    this.playerPassword = 'password';
    this.playerProvider = 'ptc';

};

var parseMapResponse = function (objects) {

    return {
        catchable: objects.wild_pokemons,
        nearby: objects.nearby_pokemons,
        spawn: objects.spawn_points,
        forts: objects.forts
    };
};

Controller.prototype.login = Q.async(function* (lat, lng, user) {

    var currentUser = this[user || 'pokemonGo'];

    currentUser.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    var _username = user ? this.playerUsername : username;
    var _password = user ? this.playerPassword : password;
    var _provider = user ? this.playerProvider : provider;

    var playerInfo = yield currentUser.login(_username, _password, _provider);

    return parseInventory(playerInfo.inventory);

});

var parseInventory = function (inventory) {

    return {
        candies: inventory.candies,
        pokemons: inventory.pokemons,
        eggs: inventory.eggs,
        items: inventory.items
    };

};

Controller.prototype.playerLogin = Q.async(function* (req, res) {

    var lat = req.body.lat;
    var lng = req.body.lng;

    this.playerUsername = req.body.username;
    this.playerPassword = req.body.password;
    this.playerProvider = req.body.provider || 'ptc';

    var playerInventory = yield this.login(lat, lng, 'externalPlayer');

    res.send(playerInventory);

});

Controller.prototype.lootPokestop = Q.async(function* (req, res) {

    var id = req.body.id;
    var mapObjects = {};

    if (this.lastTimePlayerMapCall === 0) {
        this.lastTimePlayerMapCall = new XDate().addSeconds(-15);
    }

    var diffSeconds = this.lastTimePlayerMapCall.diffSeconds(new XDate());
    if (diffSeconds >= 10) {

        mapObjects = yield this.getMapObjects(this.externalPlayer.player.location.latitude, this.externalPlayer.player.location.longitude, 'externalPlayer');

    } else {

        yield waitMs((diffSeconds % 10) * 1000);
        mapObjects = yield this.getMapObjects(this.externalPlayer.player.location.latitude, this.externalPlayer.player.location.longitude, 'externalPlayer');

    }

    if (mapObjects) {

        var pokeStop = _.find(mapObjects.forts.checkpoints, function (checkpoint) {
            var isNotCoolDown = !checkpoint.cooldown;
            var matchedId = checkpoint.id === id;

            return isNotCoolDown && matchedId;

        });

        if (pokeStop) {
            let loot = yield pokeStop.search();

            res.send(loot)

        } else {
            res.send({error: 'Too far away'});
            //res.send({error: 'Try Later'});
        }

    } else {
        res.send({error: 'No Data'});
    }


    // Collect pokestop rewards
    //
    // console.log(res)

});

Controller.prototype.getMapObjects = Q.async(function* (lat, lng, user) {

    var objects = [];
    var currentUser = this[user || 'pokemonGo'];

    currentUser.player.location = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
    };

    try {

        objects = yield currentUser.GetMapObjects();
        if (user) {
            this.lastTimePlayerMapCall = new XDate();
        } else {
            this.lastTimeMapCall = new XDate();
        }

    } catch (error) {

        console.log(error);
        if (error.message === 'Illegal buffer') {

            currentUser = new PokemonGo();

            yield this.login(lat, lng, user);

            yield this.getMapObjects(lat, lng, user);

        }

    }

    if (objects.forts && objects.forts.checkpoints.length) {
        this.socket.emit('populateMap', parseMapResponse(objects, {lat: lat, lng: lng}));

        return objects;

    }

});

Controller.prototype.getMapObjectsRoute = Q.async(function*(req, res, user) {

    this.getMapObjects(req.query.lat, req.query.lng, user);

    res.send({});

});

Controller.prototype.walkToPoint = Q.async(function*(req, res) {

    var self = this;
    let lat = req.body.lat;
    let lng = req.body.lng;
    let kmPerHour = req.body.kmh || 50;
    let stepFrequency = req.body.stepFrequency || 1; //seconds

    var latStart = this.externalPlayer.player.location.latitude;
    var lngStart = this.externalPlayer.player.location.longitude;
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

        self.externalPlayer.player.location = {
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

            self.externalPlayer.GetMapObjects().then(function (response) {

                if (response.forts.checkpoints.length) {
                    self.socket.emit('populateMap', parseMapResponse(response, coordinatesToSend));
                }

            })
        }

    };

    walkToNextpoint();
    this.walkingInterval = setInterval(walkToNextpoint, 1000 * stepFrequency);

    res.send({distance: distance});

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