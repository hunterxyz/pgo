'use strict';
var map = null;
var latLng = {lat: 48.0835518, lng: 11.4732557}; //FL-I-2
//var latLng = {lat: 48.102848, lng: 11.533405}; //FL
var pokeMarkers = [];
var spawnMarkers = [];
var pokestopMarkers = [];
//var gymMarkers = [];
var coordinateMarkers = [];
var mapHistory = [];

var marker;
var playerMarker;
var radarCircle;
var pokemonInteractionCircle;
var interactionCircle;
var destinationPoint;

var loginMenuListener;

var socket = io.connect('http://localhost:5050');

var sendStopWalking = function () {

    socket.emit('stopWalking');

};

var drawCoordinates = function (coordinates) {

    var coordinateMarker = new google.maps.Marker({
        position: {lat: coordinates.lat, lng: coordinates.lng},
        map: map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 2
        },
        zIndex: 1
    });

    coordinateMarkers.push(coordinateMarker);

};

var moveMarkers = function (latLng) {

    radarCircle.setCenter(latLng);
    pokemonInteractionCircle.setCenter(latLng);
    interactionCircle.setCenter(latLng);

};

var ms2time = function msToTime(duration) {

    var isNegative = false;
    if (duration < 0) {
        isNegative = true;
        duration = Math.abs(duration);
    }

    var seconds = parseInt((duration / 1000) % 60, 10);
    var minutes = parseInt((duration / (1000 * 60)) % 60, 10);

    minutes = (minutes < 10) ? '0' + minutes : minutes;
    seconds = (seconds < 10) ? '0' + seconds : seconds;

    if (isNegative) {
        minutes = '-' + minutes;
    }

    return minutes + ':' + seconds;

};

var clearCoordinates = function () {

    for (var i = 0; i < coordinateMarkers.length; i++) {

        var marker = coordinateMarkers[i];

        marker.setMap(null);

    }

    destinationPoint.setMap(null);

    coordinateMarkers = [];

};

function isPokemonOnMap(pokemon) {

    return _.find(pokeMarkers, function (pokeMarker) {

        return pokeMarker.pokemon.spawn_point_id === pokemon.spawn_point_id;

    });

}

var handleMarkerTimer = function (marker, pokeMarkers) {

    // if (this.time_till_hidden_ms < 0) {
    //
    //     this.time_till_hidden_ms = this.time_till_hidden_ms + 1000;
    //
    //     if (this.time_till_hidden_ms > 0) {
    //         clearInterval(this.interval);
    //         _.remove(pokeMarkers, marker);
    //         marker.setMap(null);
    //     }
    //
    // } else {

    this.time_till_hidden_ms = this.time_till_hidden_ms - 1000;

    if (this.time_till_hidden_ms <= 0) {
        clearInterval(this.interval);
        _.remove(pokeMarkers, marker);
        marker.setMap(null);
    }

    // }

    marker.setTitle(ms2time(this.time_till_hidden_ms));

};

var clickOnPokemon = function () {

    console.log(this.pokemon);

};

var createPokeMarkers = function (map, markers) {

    for (var j = 0; j < markers.length; j++) {

        var pokemon = markers[j];
        var title = ms2time(pokemon.time_till_hidden_ms);

        var pokemonOnMap = isPokemonOnMap(pokemon);

        if (pokemonOnMap && pokemonOnMap.pokemon.time_till_hidden_ms < 0 && pokemon.time_till_hidden_ms > 0) {
            pokemonOnMap.setMap(null);
            _.remove(pokeMarkers, pokemonOnMap);
            pokemonOnMap = null;
        }

        if (pokemonOnMap) {
            continue;
        }

        var image = {
            url: '/assets/images/' + pokemon.num + '.png',
            size: new google.maps.Size(120, 120),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 20),
            scaledSize: new google.maps.Size(40, 40)
        };

        var marker = new google.maps.Marker({
            position: {lat: pokemon.latitude, lng: pokemon.longitude},
            map: map,
            icon: image,
            pokemon: pokemon,
            title: title,
            zIndex: 1
        });

        if (pokemon.time_till_hidden_ms < 0) {
            marker.setOpacity(0.5);
        }

        marker.addListener('click', $.proxy(clickOnPokemon, marker));

        // marker.setMap(map);

        pokemon.interval = setInterval($.proxy(handleMarkerTimer, pokemon, marker, pokeMarkers), 1000);

        pokeMarkers.push(marker);

    }

};

var createSpawnMarker = function (map, spawnPoint) {

    var image = {
        url: '/assets/images/pokemon-egg.png',
        size: new google.maps.Size(80, 86),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(6, 6),
        scaledSize: new google.maps.Size(12, 12)
    };

    var marker = new google.maps.Marker({
        position: {lat: spawnPoint.latitude, lng: spawnPoint.longitude},
        map: map,
        icon: image,
        clickable: false,
        spawnPoint: spawnPoint,
        zIndex: 0
    });

    marker.setMap(map);

    spawnMarkers.push(marker);

};

var createSpawnMarkers = function (map, markers) {

    _.each(markers, function (marker) {

        if (Array.isArray(marker)) {
            _.each(marker, function (subMarker) {

                if (!_.some(spawnMarkers, function (spawnMarker) {
                        return spawnMarker.latitude === subMarker.latitude && spawnMarker.longitude === subMarker.longitude;
                    })) {
                    createSpawnMarker(map, subMarker);
                }

            });

        } else {

            if (!_.some(spawnMarkers, function (spawnMarker) {
                    return spawnMarker.latitude === marker.latitude && spawnMarker.longitude === marker.longitude;
                })) {
                createSpawnMarker(map, marker);
            }
        }

    });
};

var parseLoot = function (loot) {

    var reward = loot.FortSearchResponse;

    console.log(reward);

};

var clickOnPokeStop = function () {

    var psid = this.pokestop.id;
    var marker = this;

    $.ajax({
        method: 'POST',
        url: '/player/lootpokestop',
        data: JSON.stringify({id: psid}),
        contentType: 'application/json',
        dataType: 'json'
    }).success(function (result) {

        if (result.error) {
            return;
        }

        parseLoot(result);

        var image = {
            url: '/assets/images/pokestop-pink.png',
            size: new google.maps.Size(94, 200),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(12, 50),
            scaledSize: new google.maps.Size(23, 50)
        };

        marker.setIcon(image);

        setTimeout(function () {

            var image = {
                url: '/assets/images/pokestop.png',
                size: new google.maps.Size(94, 200),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(12, 50),
                scaledSize: new google.maps.Size(23, 50)
            };

            marker.setIcon(image);

        }, 5 * 1000 * 60);

    }).fail(function () {
        alert('no data');
    });

};

var createPokestopMarker = function (map, pokestop) {

    var image = {
        url: '/assets/images/pokestop.png',
        size: new google.maps.Size(94, 200),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(12, 50),
        scaledSize: new google.maps.Size(23, 50)
    };

    var marker = new google.maps.Marker({
        position: {lat: pokestop.latitude, lng: pokestop.longitude},
        map: map,
        icon: image,
        clickable: true,
        pokestop: pokestop,
        zIndex: 0
    });

    marker.setMap(map);

    marker.addListener('click', $.proxy(clickOnPokeStop, marker));

    pokestopMarkers.push(marker);

};

var createPokestopMarkers = function (map, markers) {

    _.each(markers, function (marker) {

        var noMarkerFound = !_.some(pokestopMarkers, function (pokestopMarker) {
            return pokestopMarker.pokestop.id === marker.id;
        });

        if (noMarkerFound) {
            createPokestopMarker(map, marker);
        }
    });
};

var updateNearbyRadar = function (nearbyPokemons) {

    var nearbyPlaceholder = $('.nearby');

    nearbyPlaceholder.html('');

    for (var i = 0; i < nearbyPokemons.length; i++) {

        var pokemon = nearbyPokemons[i];
        var img = $('<img/>')
            .attr('src', '/assets/images/' + pokemon.num + '.png')
            .attr('title', pokemon.name);

        nearbyPlaceholder.append(img);

    }

};

var populateMap = function (objects) {

    createPokeMarkers(map, objects.catchable);
    createPokestopMarkers(map, objects.forts.checkpoints);

    if (objects.showAll) {
        updateNearbyRadar(objects.nearby);

        createSpawnMarkers(map, objects.spawn);
    }

    mapHistory.push(objects);

};

socket.on('connect', function () {

    sendStopWalking();

    socket.on('walkedTo', function (response) {

        drawCoordinates(response);
        playerMarker.setPosition(response);
        moveMarkers(response);

    });

    socket.on('populateMap', function (objects) {

        console.log(objects);
        populateMap(objects);

    });

});

function afterLogin(coords) {

    loginMenuListener.remove();
    $('.right-click-menu').hide();
    playerMarker.setPosition(coords);
    playerMarker.setMap(map);

    map.addListener('rightclick', function (e) {

        var data = e.latLng.toJSON();

        clearCoordinates();

        destinationPoint.setPosition(e.latLng);
        destinationPoint.setMap(map);

        data.kmh = Number($('select[name=speed]').val());
        data.stepFrequency = Number($('select[name=freq]').val());

        $.ajax({
            method: 'POST',
            url: 'walktoPoint',
            data: JSON.stringify(data),
            contentType: 'application/json',
            dataType: 'json'
        }).success(function (result) {

            console.log(result.distance + ' meters');

        }).fail(function () {
            alert('no data');
        });

    });
}

$(document).ready(function () {

    var loginCoords;

    map = new google.maps.Map($('.map-placeholder')[0], {
        center: latLng,
        zoom: 14
    });

    marker = new google.maps.Marker({
        map: map
    });

    radarCircle = new google.maps.Circle({
        strokeWeight: 0,
        fillColor: '#FF0000',
        fillOpacity: 0.1,
        map: map,
        radius: 200,
        clickable: false
    });

    pokemonInteractionCircle = new google.maps.Circle({
        strokeWeight: 0,
        fillColor: '#FF0000',
        fillOpacity: 0.1,
        map: map,
        radius: 70,
        clickable: false
    });

    interactionCircle = new google.maps.Circle({
        strokeWeight: 0,
        fillColor: '#FF0000',
        fillOpacity: 0.1,
        map: map,
        radius: 40,
        clickable: false
    });

    $.ajax({
        method: 'GET',
        url: '/amilogged/pokemonGo',
        contentType: 'application/json',
        dataType: 'json'
    }).success(function (result) {

        var latLng = {lat: result.location.latitude, lng: result.location.longitude};

        marker.setPosition(latLng);
        moveMarkers(latLng);

    });

    var playerMarkerImage = {
        url: '/assets/images/pokemarker.png',
        size: new google.maps.Size(179, 250),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(15, 40),
        scaledSize: new google.maps.Size(29, 40)
    };

    var scanMapLatLngListener = map.addListener('click', function (e) {

        var latLng = e.latLng;

        socket.emit('moveTo', latLng.toJSON());
        marker.setPosition(latLng);
        moveMarkers(latLng);

    });

    playerMarker = new google.maps.Marker({
        icon: playerMarkerImage,
        zIndex: 2
    });

    destinationPoint = new google.maps.Marker({
        position: latLng,
        icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 2
        },
        zIndex: 1
    });

    loginMenuListener = map.addListener('rightclick', function (e) {

        var rightClickMenu = $('.right-click-menu');

        rightClickMenu.css({
            top: e.pixel.y,
            left: e.pixel.x
        }).show();

        loginCoords = e.latLng.toJSON();

        scanMapLatLngListener.remove();

        var closeMenuListener = map.addListener('click', function () {

            $('.login-form').hide();
            rightClickMenu.hide();

            closeMenuListener.remove();
            scanMapLatLngListener = map.addListener('click', function (e) {

                var latLng = e.latLng;

                marker.setPosition(latLng);
                moveMarkers(latLng);

            });

        });

    });

    $.ajax({
        method: 'GET',
        url: '/amilogged/externalPlayer',
        contentType: 'application/json',
        dataType: 'json'
    }).success(function (result) {

        var coordinates = {lat: result.location.latitude, lng: result.location.longitude};

        afterLogin(coordinates);

    }).fail(function () {


    });

    var $loginHere = $('.right-click-menu ul.login-here li');

    $loginHere.on('click', function () {
        $loginHere.hide();
        $('.login-form').show();

    });

    $('.go').on('click', function () {

        var data = loginCoords;

        data.username = $('[name=username]').val();
        data.password = $('[name=password]').val();
        data.provider = $('[name=provider]').val();

        $.ajax({
            method: 'POST',
            url: '/player/login',
            data: JSON.stringify(data),
            contentType: 'application/json',
            dataType: 'json'
        }).success(function (result) {

            var coordinates = {lat: result.lat, lng: result.lng};

            afterLogin(coordinates);

        }).fail(function () {
            alert('no data');
        });

    });

});