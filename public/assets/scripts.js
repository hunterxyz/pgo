'use strict';
var map = null;
var latLng = {lat: 48.0835518, lng: 11.4732557}; //FL-I-2
//var latLng = {lat: 48.102848, lng: 11.533405}; //FL
var pokeMarkers = [];
var spawnMarkers = [];
var pokestopMarkers = [];
var gymMarkers = [];

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

var handleMarkerTimer = function (marker, pokeMarkers) {

    if (this.time_till_hidden_ms < 0) {

        this.time_till_hidden_ms = this.time_till_hidden_ms + 1000;

        if (this.time_till_hidden_ms > 0) {
            clearInterval(this.interval);
            _.remove(pokeMarkers, marker);
            marker.setMap(null);
        }

    } else {

        this.time_till_hidden_ms = this.time_till_hidden_ms - 1000;

        if (this.time_till_hidden_ms < 0) {
            clearInterval(this.interval);
            _.remove(pokeMarkers, marker);
            marker.setMap(null);
        }

    }

    marker.setTitle(ms2time(this.time_till_hidden_ms));

};

var clickOnPokemon = function () {

    console.log(this.pokemon);

};

var createPokeMarkers = function (map, markers) {

    for (var j = 0; j < markers.length; j++) {

        var pokemon = markers[j];
        var title = ms2time(pokemon.time_till_hidden_ms);

        var pokemonOnMap = _.find(pokeMarkers, function (pokeMarker) {
            return pokeMarker.pokemon.spawn_point_id === pokemon.spawn_point_id;
        });

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

        marker.setMap(map);

        pokemon.interval = setInterval($.proxy(handleMarkerTimer, pokemon, marker, pokeMarkers), 1000);

        pokeMarkers.push(marker);

    }

};

var createSpawnMarkers = function (map, markers) {

    _.each(markers, function (marker) {

        if (Array.isArray(marker)) {
            _.each(marker, function (subMarker) {

                if (!_.some(spawnMarkers, function (spawnMarker) {
                        spawnMarker.latitude === subMarker.latitude && spawnMarker.longitude === subMarker.longitude;
                    })) {
                    createSpawnMarker(map, subMarker);
                }

            });

        } else {

            if (!_.some(spawnMarkers, function (spawnMarker) {
                    spawnMarker.latitude === marker.latitude && spawnMarker.longitude === marker.longitude;
                })) {
                createSpawnMarker(map, marker);
            }
        }

    });
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

var createPokestopMarkers = function (map, markers) {

    _.each(markers, function (marker) {

        var noMarkerFound = !_.some(pokeMarkers, function (pokestopMarker) {
            pokestopMarker.id === marker.id;
        });

        if (noMarkerFound) {
            createPokestopMarker(map, marker);
        }
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
        clickable: false,
        pokestop: pokestop,
        zIndex: 0
    });

    marker.setMap(map);

    pokestopMarkers.push(marker);

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

$(document).ready(function () {

    map = new google.maps.Map($('.map-placeholder')[0], {
        center: latLng,
        zoom: 14
    });

    var marker = new google.maps.Marker({
        position: latLng,
        map: map
    });

    map.addListener('click', function (e) {

        $.ajax({
            url: 'getMapObjects',
            data: e.latLng.toJSON()
        }).success(function (objects) {

            if (objects.catchable) {
                marker.setPosition(e.latLng);

                createPokeMarkers(map, objects.catchable);
                updateNearbyRadar(objects.nearby);
                createSpawnMarkers(map, objects.spawn);
                createPokestopMarkers(map, objects.forts.checkpoints);
            }

        }).fail(function () {
            alert('no data');
        })

    });

    map.addListener('rightclick', function (e) {

        $.ajax({
            method: 'POST',
            url: 'walktoPoint',
            data: JSON.stringify(e.latLng.toJSON()),
            contentType: 'application/json',
            dataType: "json"
        }).success(function (result) {

            console.log(result.distance + ' meters');

        }).fail(function () {
            alert('no data');
        })

    });

});