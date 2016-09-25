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

var waitMs = function (time) {
    return new Promise((resolve) => { // dont use reject
        setTimeout(()=> {
            resolve();
        }, time);
    });
};

require('babel-polyfill');
var Q = require('q');
var _ = require('lodash');
var pokedex = require('pokemon-go-pokedex');
var PokemonGo = require('pokemongo-api').default;

PokemonGo.prototype.recycle = Q.async(function*(item_id, count) {

    return yield this.Call([
        {
            request: 'RECYCLE_INVENTORY_ITEM',
            message: {
                item_id, count
            }
        }
    ]);

});

PokemonGo.prototype.useIncubator = Q.async(function*(item_id, pokemon_id) {

    return yield this.Call([
        {
            request: 'USE_ITEM_EGG_INCUBATOR',
            message: {
                item_id:    String(item_id),
                pokemon_id: pokemon_id
            }
        }]);

});

PokemonGo.prototype.useCapture = Q.async(function*(itemId, pokemon) {

    return yield this.Call([
        {
            request: 'USE_ITEM_CAPTURE',
            message: {
                item_id:        itemId,
                encounter_id:   pokemon.encounter_id,
                spawn_point_id: pokemon.spawn_point_id
            }
        }
    ]);

});


PokemonGo.prototype.levelUp = Q.async(function*(level) {

    return yield this.Call([
        {
            request: 'LEVEL_UP_REWARDS',
            message: {
                level: level
            }
        }
    ]);

});

var geoHelper = require('./utils/GeoHelper');

var botUsername = process.env.PGO_USERNAME || 'user';
var botPassword = process.env.PGO_PASSWORD || 'password';
var botProvider = 'ptc';
var lat = process.env.LATITUDE || 48.140582785975916;
var lng = process.env.LONGITUDE || 11.590517163276672;

var parseMapResponse = function (objects, user, coordinates) {

    return {
        coordinates: coordinates,
        catchable:   objects.wild_pokemons,
        forts:       objects.forts,
        nearby:      objects.nearby_pokemons,
        spawn:       objects.spawn_points,
        showAll:     user === 'pokemonGo'
    };
};

var serialize = function (toSerialize) {

    var value;
    var json = {};
    var excludedKeys = [
        'api',
        'parent',
        'logged',
        'logging',
        'loginCache',
        'playerInfo',
        'buffer',
        'requestInterval',
        'useHeartBeat',
        'Auth',
        'debug',
        'lastObjectsCall'
    ];

    if (typeof toSerialize === 'string') {
        return toSerialize;
    }

    if (typeof toSerialize === 'number') {
        return toSerialize;
    }

    for (var key in toSerialize) {
        if (toSerialize.hasOwnProperty(key)) {

            if (excludedKeys.indexOf(key) !== -1) {
                continue;
            }

            value = toSerialize[key];

            if (value === 'toString') {
                continue;
            }

            if (value instanceof Function) {
                continue;
            }

            if (typeof value === 'object') {

                if (value && value.high !== undefined && value.low !== undefined && value.toNumber) {
                    value = value.toNumber();
                } else if (!Array.isArray(value)) {
                    value = serialize(value);
                } else if (Array.isArray(value)) {
                    value = _.map(value, serialize);
                }

            }

            json[key] = value;
        }
    }

    return json;

};

var Controller = function () {

    this.walkingInterval = null;

    this.pokemonGoMapObjects = {};
    this.externalPlayerMapObjects = {};

    this.pokemonGo = null;
    this.externalPlayer = null;

    this.login(lat, lng);

    this.playerUsername = 'user';
    this.playerPassword = 'password';
    this.playerProvider = 'ptc';

};

Controller.prototype.checkLevelUp = Q.async(function*() {

    var lur = yield this.externalPlayer.levelUp(this.externalPlayer.player.level);

    if (lur.LevelUpRewardsResponse.items_awarded.length) {

        var response = yield this.externalPlayer.inventory.update();

        response.LevelUpRewardsResponse = lur.LevelUpRewardsResponse;

        this.socket.emit('levelUpRewards', serialize(response));

    }

});

Controller.prototype.amILoggedRoute = function (req, res) {

    var user = this[req.params.user];

    if (user && user.player && user.player.location) {

        var response = serialize(this[req.params.user]);

        response.location = {lat: user.player.location.latitude, lng: user.player.location.longitude};

        res.send(response);

    } else {
        res.status(500).send({});
    }

};

Controller.prototype.startMapScanner = function (user) {

    var self = this;

    var currentUserString = user || 'pokemonGo';

    this[currentUserString + 'Scanner'] = setInterval(function () {

        var currentUser = self[currentUserString];

        currentUser.GetMapObjects().then(function (objects) {

            var isNotEmpty = (objects.forts && objects.forts.checkpoints.length) ||
                (objects.forts && objects.forts.gyms.length) ||
                objects.catchable_pokemons.length ||
                objects.nearby_pokemons.length ||
                objects.wild_pokemons.length ||
                objects.decimated_spawn_points.length;

            if (isNotEmpty) {

                self[user + 'MapObjects'] = objects;

                var playerCoordinates = {
                    lat: currentUser.player.location.latitude,
                    lng: currentUser.player.location.longitude
                };

                self.socket.emit('populateMap', parseMapResponse(objects, user, playerCoordinates));

            }
        }).catch(function (result) {

            if (result.message === 'Illegal buffer') {

                self.login(currentUser.player.location.latitude, currentUser.player.location.longitude, user || 'pokemonGo', true);

            }

        });

    }, 10 * 1000);

};

Controller.prototype.stopMapScanner = function (user) {

    clearInterval(this[user + 'Scanner']);

};

Controller.prototype.login = Q.async(function*(lat, lng, user, doNotScan) {

    var currentUserString = user || 'pokemonGo';

    this[currentUserString] = new PokemonGo();

    var currentUser = this[currentUserString];

    currentUser.player.location = {
        latitude:  parseFloat(lat),
        longitude: parseFloat(lng)
    };

    var _username = currentUserString !== 'pokemonGo' ? this.playerUsername : botUsername;
    var _password = currentUserString !== 'pokemonGo' ? this.playerPassword : botPassword;
    var _provider = currentUserString !== 'pokemonGo' ? this.playerProvider : botProvider;

    var playerInfo = yield currentUser.login(_username, _password, _provider);

    currentUser.playerObject = yield currentUser.GetPlayer();
    currentUser.pokedex = pokedex;
    currentUser.logged = true;

    if (!doNotScan) {
        this.startMapScanner(currentUserString);
    }

    var serializedPlayer = serialize(playerInfo);

    return serializedPlayer;

});

Controller.prototype.useIncubatorRoute = Q.async(function*(req, res) {

    var eggId = req.body.egg_id;
    var incubatorId = req.body.incubator_id;

    var useIncubatorResponse = yield this.externalPlayer.useIncubator(incubatorId, eggId);

    console.log(useIncubatorResponse);

    yield this.externalPlayer.inventory.update();

    res.send(serialize(this.externalPlayer));

});

Controller.prototype.recycleRoute = Q.async(function*(req, res) {

    var item_id = req.body.item_id;
    var count = Number(req.body.count);

    yield this.externalPlayer.recycle(item_id, count);

    yield this.externalPlayer.inventory.update();

    res.send(serialize(this.externalPlayer));

});

Controller.prototype.transferRoute = Q.async(function*(req, res) {

    var id = Number(req.body.id);

    var pokemonToTransfer = _.find(this.externalPlayer.inventory.pokemons, function (pokemon) {

        return pokemon.id.toNumber() === id;

    });

    yield pokemonToTransfer.release();

    yield this.externalPlayer.inventory.update();

    res.send(serialize(this.externalPlayer));

});

Controller.prototype.evolveRoute = Q.async(function*(req, res) {

    var id = Number(req.body.id);

    var toEvolve = _.find(this.externalPlayer.inventory.pokemons, function (pokemon) {

        return pokemon.id.toNumber() === id;

    });

    if (toEvolve) {

        yield toEvolve.evolve();

        yield this.externalPlayer.inventory.update();

        res.send(serialize(this.externalPlayer));

    } else {

        res.send({error: 'Pokemon not found.'});

    }

});

Controller.prototype.renameRoute = Q.async(function*(req, res) {

    var id = Number(req.body.id);
    var name = req.body.name;

    var toRename = _.find(this.externalPlayer.inventory.pokemons, function (pokemon) {

        return pokemon.id.toNumber() === id;

    });

    if (toRename) {

        yield toRename.__proto__.nickname.call(toRename, name);

        yield this.externalPlayer.inventory.update();

        res.send(serialize(this.externalPlayer));

    } else {

        res.send({error: 'Pokemon not found.'});

    }

});

Controller.prototype.checkHatchedEggs = Q.async(function*() {

    var hatchedEggs = yield this.externalPlayer.player.hatchedEggs();

    var hatchedEggsResponse = hatchedEggs.GetHatchedEggsResponse;

    if (hatchedEggsResponse.success && hatchedEggsResponse.pokemon_id.length > 0) {

        yield this.externalPlayer.inventory.update();

        var response = serialize(this.externalPlayer);
        response.GetHatchedEggsResponse = serialize(hatchedEggsResponse);

        this.socket.emit('hatchedEgg', response);

        yield this.checkLevelUp();
    }

});

Controller.prototype.loginRoute = Q.async(function*(req, res) {

    var lat = req.body.lat;
    var lng = req.body.lng;

    this.playerUsername = req.body.username;
    this.playerPassword = req.body.password;
    this.playerProvider = req.body.provider || 'ptc';

    var playerInfo = yield this.login(lat, lng, 'externalPlayer');

    playerInfo.location = {lat, lng};

    res.send(playerInfo);

});

Controller.prototype.logoutRoute = function (req, res) {

    this.playerUsername = null;
    this.playerPassword = null;
    this.playerProvider = null;

    this.stopMapScanner('externalPlayer');
    clearInterval(this.walkingInterval);
    this.externalPlayer = null;

    res.send({});

};

Controller.prototype.lootPokestop = Q.async(function*(req, res) {

    var id = req.body.id;

    if (this.externalPlayerMapObjects) {

        var pokeStop = _.find(this.externalPlayerMapObjects.forts.checkpoints, function (checkpoint) {
            var isNotCoolDown = !checkpoint.cooldown;
            var inRange = checkpoint.withinRange;
            var matchedId = checkpoint.id === id;

            return isNotCoolDown && matchedId && inRange;

        });

        if (pokeStop) {
            let loot = yield pokeStop.search();
            yield this.externalPlayer.inventory.update();
            var response = {loot, playerInfo: serialize(this.externalPlayer)};

            yield this.checkLevelUp();

            res.send(response);

        } else {
            res.send({error: 'Too far away'});
            //res.send({error: 'Try Later'});
        }

    } else {
        res.send({error: 'No Data'});
    }

});

Controller.prototype.encounterPokemonRoute = Q.async(function*(req, res) {

    var pokemonLocation = req.body.location;

    if (this.externalPlayerMapObjects) {

        var pokemon = _.find(this.externalPlayerMapObjects.catchable_pokemons, {
            latitude:  pokemonLocation.lat,
            longitude: pokemonLocation.lng
        });

        if (pokemon) {

            this.externalPlayer.lastEncounteredPokemon = pokemon;

            var encouterResult = yield pokemon.encounter();

            var result = serialize(this.externalPlayer);

            result.EncounterResponse = serialize(encouterResult.EncounterResponse);

            res.send(result);

        }

        res.send({error: 'Too far away'});

    } else {

        res.send({error: 'Too far away'});

    }

});

Controller.prototype.catchEncounteredPokemonRoute = Q.async(function*(req, res) {

    var ball = req.body.ball;
    var useRazzBerry = !!req.body.useRazzBerry;

    if (useRazzBerry && this.externalPlayer.inventory.items.razzBerry.count) {
        yield this.externalPlayer.useCapture(this.externalPlayer.inventory.items.razzBerry.item_id, this.externalPlayer.lastEncounteredPokemon);
    }

    var catchResult = yield this.externalPlayer.lastEncounteredPokemon.catch(ball);

    yield waitMs(1000);

    yield this.checkLevelUp();

    yield waitMs(1000);

    yield this.externalPlayer.inventory.update();

    var response = serialize(this.externalPlayer);

    response.catchResult = serialize(catchResult);

    res.send(response);

});

Controller.prototype.encounterAndCatchPokemonRoute = Q.async(function*(req, res) {

    var ball = req.body.ball;
    var useRazzBerry = !!req.body.useRazzBerry;
    var pokemonLocation = req.body.location;

    if (this.externalPlayerMapObjects) {

        var pokemon = _.find(this.externalPlayerMapObjects.catchable_pokemons, {
            latitude:  pokemonLocation.lat,
            longitude: pokemonLocation.lng
        });

        if (pokemon) {

            var encounteredPokemon = yield pokemon.encounter();

            if (useRazzBerry && this.externalPlayer.inventory.items.razzBerry.count) {
                yield this.externalPlayer.useCapture(this.externalPlayer.inventory.items.razzBerry.item_id, pokemon);
            }

            var catchResult = yield pokemon.catch(ball);

            yield waitMs(2000);

            yield this.externalPlayer.inventory.update();

            var response = serialize(this.externalPlayer);

            response.encounteredPokemon = serialize(encounteredPokemon);
            response.catchResult = serialize(catchResult);

            yield this.checkLevelUp();

            res.send(response);

        } else {
            res.send({error: 'Too far away'});
        }

    } else {
        res.send({error: 'No Data'});
    }

});

Controller.prototype.walkToPoint = function (req, res) {

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
        var stepDistance = metersPerSecond * stepFrequency;
        var nexStepDistance = ((timer / stepFrequency)) * stepDistance;

        if (timer % 15 === 0) {
            self.checkHatchedEggs();
        }

        if (timer > seconds || nexStepDistance > distance) {
            stepDistance = distance % (metersPerSecond * stepFrequency);
            clearInterval(self.walkingInterval);
            isLastStep = true;
        }

        var bearing = geoHelper.getBearing(latStart, lngStart, lat, lng);
        var newCoordinates = geoHelper.getDestinationPoint(latStart, lngStart, stepDistance, bearing);
        newCoordinates.isLastStep = isLastStep;

        latStart = newCoordinates.lat;
        lngStart = newCoordinates.lng;

        self.externalPlayer.player.location = {
            latitude:  newCoordinates.lat,
            longitude: newCoordinates.lng
        };

        var walkingData = newCoordinates;

        walkingData.kmsSoFar = nexStepDistance;

        self.socket.emit('walkedTo', newCoordinates);

        return isLastStep;

    };

    this.walkingInterval = setInterval(walkToNextpoint, 1000 * stepFrequency);

    res.send({distance: distance, time: Math.ceil(seconds / stepFrequency) * stepFrequency});

};

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

    self.socket.on('moveTo', function (latLng) {
        self.pokemonGo.player.location = {
            latitude:  latLng.lat,
            longitude: latLng.lng
        };
    });

};

module.exports = new Controller();