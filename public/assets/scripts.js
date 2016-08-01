'use strict';
var map = null;
var latLng = {lat: 48.102848, lng: 11.533405};
var pokeMarkers = [];

var ms2time = function msToTime(duration) {

    var seconds = parseInt((duration / 1000) % 60);
    var minutes = parseInt((duration / (1000 * 60)) % 60);

    minutes = (minutes < 10) ? '0' + minutes : minutes;
    seconds = (seconds < 10) ? '0' + seconds : seconds;

    return minutes + ':' + seconds;

};

var handleMarkerTimer = function (marker) {

    this.time_till_hidden_ms = this.time_till_hidden_ms - 1000;

    if (this.time_till_hidden_ms < 0) {
        clearInterval(this.interval);
        marker.setMap(null);
    }

    marker.setTitle(ms2time(this.time_till_hidden_ms));

};

var createPokeMarker = function (map, markers) {

    for (var j = 0; j < markers.length; j++) {

        var pokemon = markers[j];

        var pokemonOnMap = _.find(pokeMarkers, function (pokeMarker) {
            return pokeMarker.spawn_point_id === pokemon.spawn_point_id;
        });

        if (pokemonOnMap || pokemon.time_till_hidden_ms < 0) {
            continue;
        }

        var image = {
            url:        pokemon.img,
            size:       new google.maps.Size(120, 120),
            origin:     new google.maps.Point(0, 0),
            anchor:     new google.maps.Point(30, 30),
            scaledSize: new google.maps.Size(60, 60)
        };

        var marker = new google.maps.Marker({
            position: {lat: pokemon.latitude, lng: pokemon.longitude},
            map:      map,
            icon:     image,
            pokemon:  pokemon,
            title:    ms2time(pokemon.time_till_hidden_ms)
        });

        marker.setMap(map);

        pokemon.interval = setInterval($.proxy(handleMarkerTimer, pokemon, marker), 1000);

        pokeMarkers.push(marker);

    }

};

var updateNearbyRadar = function (nearbyPokemons) {

    var nearbyPlaceholder = $('.nearby');

    nearbyPlaceholder.html('');

    for (var i = 0; i < nearbyPokemons.length; i++) {
        var pokemon = nearbyPokemons[i];

        var img = $('<img/>').attr('src', pokemon.img);
        nearbyPlaceholder.append(img);

    }

};

$(document).ready(function () {

    map = new google.maps.Map($('.map-placeholder')[0], {
        center: latLng,
        zoom:   14
    });

    var marker = new google.maps.Marker({
        position: latLng,
        map:      map
    });

    map.addListener('click', function (e) {

        $.ajax({
            url:  'getMapObjects',
            data: e.latLng.toJSON(),
        }).success(function (objects) {

            marker.setPosition(e.latLng);

            createPokeMarker(map, objects.catchable);
            updateNearbyRadar(objects.nearby);

        });

    });

});