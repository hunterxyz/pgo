'use strict';
var map = null;
var latLng = {lat: 48.0835518, lng: 11.4732557}; //FL-I-2
//var latLng = {lat: 48.102848, lng: 11.533405}; //FL
var pokeMarkers = [];
var spawnMarkers = [];
var pokestopMarkers = [];
var coordinateMarkers = [];

var marker;
var playerMarker;
var radarCircle;
var pokemonInteractionCircle;
var interactionCircle;
var destinationPoint;

var loginMenuListener;
var loginCoords;
var rightClickListener;

var socket = io.connect('http://localhost:5050');

var levels = [
    1000,
    2000,
    3000,
    4000,
    5000,
    6000,
    7000,
    8000,
    9000,
    10000,
    10000,
    10000,
    10000,
    15000,
    20000,
    20000,
    20000,
    25000,
    25000,
    50000,
    75000,
    100000,
    125000,
    150000,
    190000,
    200000,
    250000,
    300000,
    350000,
    500000,
    500000,
    750000,
    100000,
    1250000,
    1500000,
    2000000,
    2500000,
    3000000,
    5000000
];

var clearCoordinates = function () {

    for (var i = 0; i < coordinateMarkers.length; i++) {

        var marker = coordinateMarkers[i];

        marker.setMap(null);

    }

    destinationPoint.setMap(null);

    coordinateMarkers = [];

};

var drawCoordinates = function (coordinates) {

    var coordinateMarker = new google.maps.Marker({
        position: {lat: coordinates.lat, lng: coordinates.lng},
        map:      map,
        icon:     {
            path:  google.maps.SymbolPath.CIRCLE,
            scale: 2
        },
        zIndex:   1
    });

    coordinateMarkers.push(coordinateMarker);

};

var moveCircles = function (latLng) {

    radarCircle.setCenter(latLng);
    pokemonInteractionCircle.setCenter(latLng);
    interactionCircle.setCenter(latLng);

};

var moveBotMarkerTo = function (e) {

    var latLng = e.latLng;

    socket.emit('moveTo', latLng.toJSON());
    marker.setPosition(latLng);
    moveCircles(latLng);

};

var startCountdown = function (etaSeconds) {

    $('.eta').TimeCircles().destroy();
    $('.walking-data').addClass('visible');
    $('.distance-so-far').text(0);
    $('.eta').data('timer', etaSeconds).TimeCircles({
        time: {
            Days:    {
                text:  'Days',
                color: '#FFCC66',
                show:  false
            },
            Hours:   {
                text:  'Hours',
                color: '#99CCFF',
                show:  true
            },
            Minutes: {
                text:  'Minutes',
                color: '#BBFFBB',
                show:  true
            },
            Seconds: {
                text:  'Seconds',
                color: '#FF9999',
                show:  true
            }
        }
    }).addListener(function (unit, value, total) {
        if (total < 0) {
            $('.walking-data').removeClass('visible');
            $('.eta').TimeCircles().stop();
        }
    });

};

var afterLogin = function (result) {

    var coords = result.location;

    loginMenuListener.remove();
    $('.right-click-menu').hide();
    updatePlayerStatus(result);

    $('.pokemon-tabs').tabs();

    playerMarker.setPosition(coords);
    playerMarker.setMap(map);

    rightClickListener = map.addListener('rightclick', function (e) {

        var data = e.latLng.toJSON();

        clearCoordinates();

        var startPosition = playerMarker.getPosition().toJSON();

        drawCoordinates(startPosition);
        playerMarker.setPosition(startPosition);
        moveCircles(startPosition);

        destinationPoint.setPosition(e.latLng);
        destinationPoint.setMap(map);

        data.kmh = Number($('select[name=speed]').val());
        data.stepFrequency = Number($('select[name=freq]').val());

        $.ajax({
            method:      'POST',
            url:         'walktoPoint',
            data:        JSON.stringify(data),
            contentType: 'application/json',
            dataType:    'json'
        }).success(function (result) {

            startCountdown(result.time);
            $('.total-distance').text((result.distance / 1000).toFixed(3));

        }).fail(function () {
            alert('no data');
        });

    });
};

var login = function () {

    var data = loginCoords;

    data.username = $('[name=username]').val();
    data.password = $('[name=password]').val();
    data.provider = $('[name=provider]').val();

    $.ajax({
        method:      'POST',
        url:         '/player/login',
        data:        JSON.stringify(data),
        contentType: 'application/json',
        dataType:    'json'
    }).success(function (result) {

        afterLogin(result);

    }).fail(function () {
        alert('no data');
    });

};

var initMapMouseInterations = function () {

    var scanMapLatLngListener = map.addListener('click', $.proxy(moveBotMarkerTo, this));

    var $loginHere = $('.right-click-menu ul.login-here');

    loginMenuListener = map.addListener('rightclick', function (e) {

        var rightClickMenu = $('.right-click-menu');

        rightClickMenu.css({
            top:  e.pixel.y,
            left: e.pixel.x
        }).show();

        loginCoords = e.latLng.toJSON();

        scanMapLatLngListener.remove();

        var closeMenuListener = map.addListener('click', function () {

            $('.login-form').hide();
            rightClickMenu.hide();
            $loginHere.show();

            closeMenuListener.remove();
            scanMapLatLngListener = map.addListener('click', $.proxy(moveBotMarkerTo, this));

        });

        $('.go').on('click', $.proxy(login, this));

    });

    $loginHere.find('li').on('click', function () {
        $loginHere.hide();
        $('.login-form').show();

    });

};

var afterLogout = function () {

    clearCoordinates();
    playerMarker.setMap(null);
    moveCircles(marker.getPosition());
    rightClickListener.remove();
    initMapMouseInterations();
    $('.walking-data').removeClass('visible');
    $('.player-status').hide();

};

var logout = function () {

    $.ajax({
        method:      'POST',
        url:         '/player/logout',
        contentType: 'application/json',
        dataType:    'json'
    }).success(function (result) {

        afterLogout(result);

    }).fail(function () {
        alert('no data');
    });

};

var sendStopWalking = function () {

    socket.emit('stopWalking');

};

var ms2time = function msToTime(duration) {

    var isNegative = false;
    //if (duration < 0) {
    //    isNegative = true;
    //    duration = Math.abs(duration);
    //}

    var seconds = parseInt((duration / 1000) % 60, 10);
    var minutes = parseInt((duration / (1000 * 60)) % 60, 10);

    minutes = (minutes < 10) ? '0' + minutes : minutes;
    seconds = (seconds < 10) ? '0' + seconds : seconds;

    if (isNegative) {
        minutes = '-' + minutes;
    }

    return minutes + ':' + seconds;

};

var isPokemonOnMap = function (pokemon) {

    return _.find(pokeMarkers, function (pokeMarker) {

        return pokeMarker.pokemon.spawn_point_id === pokemon.spawn_point_id;

    });

};

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

var findFamily = function (pokemon, pokedex) {

    if (pokemon.prev_evolution) {

        return findFamily(_.find(pokedex, {num: pokemon.prev_evolution[0].num}), pokedex);

    } else {

        return pokemon;

    }

};

var findCandies = function (pokemon, result) {

    var familyPokemon = findFamily(pokemon, result.pokedex.pokemon);

    var candy = _.find(result.inventory.candies, function (candy) {
        return candy.family_id === Number(familyPokemon.num);
    });

    return {candies: candy.candy, name: familyPokemon.name};

};

var updateItems = function (result) {
    var $item;
    var razzBerryWasSelected = $('.backpack .item.berry input[type=checkbox]:checked').length;
    var selectedBall = $('[type=radio]:checked').parent().parent().find('.item-recycle button').data('itemId');
    var $backpack = $('.backpack tbody').html('');
    var $itemrow = $('<tr/>').addClass('item');
    var $itemImage = $('<td><img/></td>').addClass('item-image');
    var $itemCount = $('<td><div class="item-count"></td>');
    var $itemSelection = $('<td/>').addClass('item-selection');
    var $itemRecycle = $('<td><input value="0"/> <button class="recycle">Remove</button></td>').addClass('item-recycle');
    var $counter = $('.backpack-wrapper .count');

    $counter.find('.count').text(_.sum(_.map(result.inventory.items, function (item) {

        return item.count ? item.count : 0;

    })));

    $counter.find('.total').text(result.playerObject.max_item_storage);

    $itemrow.append($itemImage);
    $itemrow.append($itemCount);
    $itemrow.append($itemSelection);
    $itemrow.append($itemRecycle);

    _.each(result.inventory.items, function (item, k) {

        if (item.count) {

            $item = $itemrow.clone();

            $item.find('img').attr('src', '/assets/images/items/' + k + '.png');
            $item.find('.item-count').text(item.count);

            var itemSelection = $item.find('.item-selection');
            var input = $('<input type="checkbox" class="item-selection"/>');
            var $itemRecycleButton = $item.find('.item-recycle button');

            if (k.match(/ball/i)) {
                $item.addClass('ball');
                input.attr('type', 'radio').attr('name', 'ball');

                if (k.match(/poke/i)) {

                    input.attr('checked', true);

                } else if (selectedBall === item.item_id) {

                    input.attr('checked', true);

                }

                itemSelection.append(input);

            } else if (k.match(/berry/i)) {

                $item.addClass('berry');
                input.attr('type', 'checkbox').attr('name', 'berry');

                if (razzBerryWasSelected) {
                    input.prop('checked', true);
                }

                itemSelection.append(input);

            } else if (k.match(/unlimited/i)) {

                $item.find('.item-recycle input').remove();
                $itemRecycleButton.remove();
                $item.find('.item-count').text('∞');

            }

            $itemRecycleButton.data('item-id', item.item_id).on('click', function () {

                var $input = $itemRecycleButton.parent().find('input');
                var data = {item_id: $itemRecycleButton.data('itemId'), count: $input.val()};

                if (data.count > 0) {
                    $.ajax({
                        method:      'POST',
                        url:         '/player/recycle',
                        data:        JSON.stringify(data),
                        contentType: 'application/json',
                        dataType:    'json'
                    }).success(updatePlayerStatus);
                }

            });

            $backpack.append($item);
        }
    });
};

var updatePokemonList = function (result) {

    createPokemonListThumbnails(result);
    createEggListThumbnails(result);
    createIcubatorListThumbnails(result);
};

var updatePlayerStatus = function (result) {

    $('.player-status .level').text(result.player.level);
    $('.player-status').show();

    var nextLevel = result.player.next_level_xp;
    var prevLevel = 0;
    var exp = result.player.experience;

    for (var i = 0; i < result.player.level - 1; i++) {

        var level = levels[i];

        prevLevel += level;

    }

    var percentage = (exp - prevLevel) * 100 / (nextLevel - prevLevel);

    $('.player-status .exp-level').css({
        width: percentage + '%'
    });

    updateItems(result);
    updatePokemonList(result);

};

var resetTransferButton = function (pokemon) {

    var pokemonDetailsWrapper = $('.pokemon-details-wrapper');
    var pokemonDetails = pokemonDetailsWrapper.find('.pokemon-details');

    pokemonDetails.find('.transfer-button').off('click');
    pokemonDetails.find('.transfer-button').on('click', function () {

        $.ajax({
            method:      'POST',
            url:         '/player/transfer',
            data:        JSON.stringify({id: pokemon.id}),
            contentType: 'application/json',
            dataType:    'json'
        }).success(function (result) {

            pokemonDetailsWrapper.find('.close').click();
            updatePokemonList(result);

        }).fail(function () {
            alert('no data');
        });

    });

};

var openDetails = function (pokemon, result) {

    var pokemonDetailsWrapper = $('.pokemon-details-wrapper');

    var pokemonDetails = pokemonDetailsWrapper.find('.pokemon-details');

    pokemonDetails.find('img.pokemon-picture').prop('src', '/assets/images/pokemons/' + pokemon.num + '.png');
    pokemonDetails.find('.points').text(pokemon.cp);
    var pokemonFamilyCandies = findCandies(pokemon, result);
    pokemonDetails.find('.total-candies').text(pokemonFamilyCandies.candies);
    pokemonDetails.find('.candy-family').text(pokemonFamilyCandies.name);
    pokemonDetails.find('.total-stardust').text(result.playerObject.currencies[1].amount);

    resetTransferButton(pokemon);

    pokemonDetailsWrapper.addClass('open');

};

var createPokemonListThumbnails = function (result) {

    var $counter = $('.pokemons-wrapper .pokemons-tab-link .counter');

    $counter.find('.count').text(result.inventory.pokemons.length + result.inventory.eggs.length);
    $counter.find('.total').text(result.playerObject.max_pokemon_storage);

    var $pokemonsContainer = $('.pokemons-wrapper .pokemons');
    var pokemonsList = _.orderBy(result.inventory.pokemons, ['name', 'cp'], ['asc', 'desc']);
    $pokemonsContainer.html('');

    _.each(pokemonsList, function (pokemon) {

        var pokemonTemplate = $('.templates .pokemon').clone();

        pokemonTemplate.find('.cp .points').text(pokemon.cp);

        pokemonTemplate.find('img').prop('src', '/assets/images/pokemons/' + pokemon.num + '.png');

        var staminaPercentage = pokemon.stamina * 100 / pokemon.stamina_max;
        pokemonTemplate.find('.hp-level').width(staminaPercentage + '%');
        pokemonTemplate.find('.name').text(pokemon.name);
        pokemonTemplate.on('click', $.proxy(openDetails, this, pokemon, result));

        $pokemonsContainer.append(pokemonTemplate);

    });
};

var createEggListThumbnails = function (result) {

    var $counter = $('.pokemons-wrapper .eggs-tab-link .counter');

    $counter.find('.count').text(result.inventory.eggs.length);

    var $eggsContainer = $('.pokemons-wrapper .eggs-selection');
    $eggsContainer.html('');

    _.each(result.inventory.eggs, function (egg) {

        var eggTemplate = $('.templates .egg').clone();

        eggTemplate.find('.walked').text(Number(egg.egg_km_walked_start).toFixed(1));
        eggTemplate.find('.target').text(Number(egg.egg_km_walked_target).toFixed(1));

        if (egg.egg_incubator_id) {
            eggTemplate.find('img').prop('src', '/assets/images/items/incubatorBasicUnlimited.png');
        } else {
            eggTemplate.find('img').prop('src', '/assets/images/pokemon-egg.png');

            eggTemplate.on('click', function () {

                var $incubatorsContainer = $('.pokemons-wrapper .incubators-layer');

                $incubatorsContainer.addClass('open').data('eggId', egg.id);

            });
        }

        $eggsContainer.append(eggTemplate);

    });
};

var attachIncubatorAction = function ($incubator) {

    $incubator.on('click', function () {

        var eggId = $(this).parents('.incubators-layer').data('eggId');
        var incubatorId = $(this).data('itemId');

        var data = {
            egg_id:       eggId,
            incubator_id: incubatorId
        };

        $.ajax({
            method:      'POST',
            url:         '/player/useIncubator',
            data:        JSON.stringify(data),
            contentType: 'application/json',
            dataType:    'json'
        }).success(function (result) {

            updatePlayerStatus(result);

        });

    });

};
var createIcubatorListThumbnails = function (result) {

    var $incubatorsContainer = $('.pokemons-wrapper .incubators-layer .incubators');
    $incubatorsContainer.html('');
    /*
     incubatorBasic
     :
     {item_id: 902, count: 2, unseen: false}
     $incubatorBasicUnlimited
     :
     {item_id: 901, count: 1, unseen: true}
     */
    var $incubatorTemplate = $('.templates .incubator');

    var items = result.inventory.items;

    if (items.incubatorBasicUnlimited.count) {

        var $incubatorBasicUnlimited = $incubatorTemplate.clone();

        $incubatorBasicUnlimited.find('img').prop('src', '/assets/images/items/incubatorBasicUnlimited.png');
        $incubatorBasicUnlimited.data('itemId', items.incubatorBasicUnlimited.item_id);
        attachIncubatorAction($incubatorBasicUnlimited);

        $incubatorsContainer.append($incubatorBasicUnlimited);
    }

    if (items.incubatorBasic.count) {
        for (var i = 0; i < items.count; i++) {

            var incubatorBasic = $incubatorTemplate.clone();

            incubatorBasic.find('img').prop('src', '/assets/images/items/incubatorBasic.png');
            incubatorBasic.data('itemId', items.incubatorBasic.item_id);
            attachIncubatorAction(incubatorBasic);
            $incubatorsContainer.append(incubatorBasic);

        }

    }

};

var limitMarkers = function (markers, limit) {

    var length = markers.length;

    if (length > limit) {

        var toRemove = length - limit;

        for (var i = 0; i < toRemove; i++) {

            var marker = markers[i];

            if (marker.setMap) {
                marker.setMap(null);
            }

        }

        markers = markers.slice(toRemove);

    }

    return markers;

};

var clickOnPokemon = function () {

    var marker = this;

    var data = {
        location:     {
            lat: this.pokemon.latitude,
            lng: this.pokemon.longitude
        },
        ball:         $('.backpack .item.ball input[type=radio]:checked').parents('tr').find('.recycle').data('itemId'),
        useRazzBerry: $('.backpack .item.berry input[type=checkbox]:checked').length
    };

    if (!data.ball){
        alert('Select a Ball');
        return;
    }

    $.ajax({
        method:      'POST',
        url:         '/player/catchpokemon',
        data:        JSON.stringify(data),
        contentType: 'application/json',
        dataType:    'json'
    }).success(function (result) {

        if (!result.error) {
            console.log(result.catchResult);
            updatePlayerStatus(result);

            switch (result.catchResult.CatchPokemonResponse.status) {

                case 0:
                    alert('You reached your pokemon limit.');
                    break;
                case 1:
                    alert('Pokemon Caught!!! :D');
                    marker.setMap(null);
                    break;
                case 2:
                    alert('The Pokemon broke out from the ball. :|');
                    break;
                case 3:
                    alert('The Pokemon ran away! :,(');
                    marker.setMap(null);
                    break;
                case 4:
                    alert('You missed the pokemon. O_O');
                    break;
            }

        } else {
            alert('Too far away.');
        }

    }).fail(function () {
        alert('no data');
    });

};

var createPokeMarkers = function (map, markers) {

    for (var j = 0; j < markers.length; j++) {

        var pokemon = markers[j];
        var title = ms2time(pokemon.time_till_hidden_ms);

        var pokemonOnMap = isPokemonOnMap(pokemon);

        if (pokemonOnMap && pokemonOnMap.pokemon.time_till_hidden_ms < 0) {
            pokemonOnMap.setMap(null);
            _.remove(pokeMarkers, pokemonOnMap);
            pokemonOnMap = null;
        }

        if (pokemonOnMap) {
            continue;
        }

        var image = {
            url:        '/assets/images/pokemons/' + pokemon.num + '.png',
            size:       new google.maps.Size(120, 120),
            origin:     new google.maps.Point(0, 0),
            anchor:     new google.maps.Point(20, 20),
            scaledSize: new google.maps.Size(40, 40)
        };

        var marker = new google.maps.Marker({
            position: {lat: pokemon.latitude, lng: pokemon.longitude},
            map:      map,
            icon:     image,
            pokemon:  pokemon,
            title:    title,
            zIndex:   1
        });

        if (pokemon.time_till_hidden_ms < 0) {
            marker.setOpacity(0.5);
        }

        marker.addListener('click', $.proxy(clickOnPokemon, marker));

        pokemon.interval = setInterval($.proxy(handleMarkerTimer, pokemon, marker, pokeMarkers), 1000);

        pokeMarkers.push(marker);

    }

};

var createSpawnMarker = function (map, spawnPoint) {

    var image = {
        url:        '/assets/images/pokemon-egg.png',
        size:       new google.maps.Size(80, 86),
        origin:     new google.maps.Point(0, 0),
        anchor:     new google.maps.Point(6, 6),
        scaledSize: new google.maps.Size(12, 12)
    };

    var marker = new google.maps.Marker({
        position:   {lat: spawnPoint.latitude, lng: spawnPoint.longitude},
        map:        map,
        icon:       image,
        clickable:  false,
        spawnPoint: spawnPoint,
        zIndex:     1
    });

    marker.setMap(map);

    spawnMarkers.push(marker);

};

var createSpawnMarkers = function (map, markers) {

    if (Array.isArray(markers)) {

        _.each(markers, function (marker) {
            createSpawnMarkers(map, marker);
        });

    } else {

        if (!_.some(spawnMarkers, function (spawnMarker) {

                var samePosition = spawnMarker.spawnPoint.latitude === markers.latitude && spawnMarker.spawnPoint.longitude === markers.longitude;

                return samePosition;

            })) {
            createSpawnMarker(map, markers);
        }
    }

};

var parseLoot = function (loot) {

    var reward = loot.FortSearchResponse;

    console.log(reward);

};

var resetPokestopIconIn = function (marker, timeout) {

    clearTimeout(marker.timeout);

    var image = {
        url:        '/assets/images/pokestop-pink.png',
        size:       new google.maps.Size(94, 200),
        origin:     new google.maps.Point(0, 0),
        anchor:     new google.maps.Point(12, 50),
        scaledSize: new google.maps.Size(23, 50)
    };

    marker.setIcon(image);

    marker.timeout = setTimeout(function () {

        var image = {
            url:        '/assets/images/pokestop.png',
            size:       new google.maps.Size(94, 200),
            origin:     new google.maps.Point(0, 0),
            anchor:     new google.maps.Point(12, 50),
            scaledSize: new google.maps.Size(23, 50)
        };

        marker.setIcon(image);

    }, timeout);

};

var clickOnPokeStop = function () {

    var psid = this.pokestop.id;
    var marker = this;

    $.ajax({
        method:      'POST',
        url:         '/player/lootpokestop',
        data:        JSON.stringify({id: psid}),
        contentType: 'application/json',
        dataType:    'json'
    }).success(function (result) {

        if (!result.loot || result.error) {
            return;
        }

        if (result.loot.FortSearchResponse.result === 4) {
            alert('Your backpack is full');
        }

        parseLoot(result.loot);
        updatePlayerStatus(result.playerInfo);

        resetPokestopIconIn(marker, 5 * 1000 * 60);

    }).fail(function () {
        alert('no data');
    });

};

var createPokestopMarker = function (map, pokestop) {

    var image = {
        url:        '/assets/images/pokestop.png',
        size:       new google.maps.Size(94, 200),
        origin:     new google.maps.Point(0, 0),
        anchor:     new google.maps.Point(12, 50),
        scaledSize: new google.maps.Size(23, 50)
    };

    var marker = new google.maps.Marker({
        position:  {lat: pokestop.latitude, lng: pokestop.longitude},
        map:       map,
        icon:      image,
        clickable: true,
        pokestop:  pokestop,
        zIndex:    1
    });

    marker.setMap(map);

    marker.addListener('click', $.proxy(clickOnPokeStop, marker));

    pokestopMarkers.push(marker);

    pokestopMarkers = limitMarkers(pokestopMarkers, 500);

};

var updateCooldown = function (marker, pokestop) {

    var remainingTime = new XDate().diffMilliseconds(new XDate(pokestop.cooldown));

    if (remainingTime > 0) {
        resetPokestopIconIn(marker, remainingTime);
    }

};

var createPokestopMarkers = function (map, pokestops) {

    _.each(pokestops, function (pokestop) {

        var foundMarker = _.find(pokestopMarkers, function (pokestopMarker) {
            return pokestopMarker.pokestop.id === pokestop.id;
        });

        if (!foundMarker) {
            createPokestopMarker(map, pokestop);
        } else if (pokestop.cooldown) {
            updateCooldown(foundMarker, pokestop);
        }

    });
};

var updateNearbyRadar = function (nearbyPokemons) {

    var nearbyPlaceholder = $('.nearby');
    $('.nearby-wrapper .bot-timer').TimeCircles().restart();
    nearbyPlaceholder.html('');

    for (var i = 0; i < nearbyPokemons.length; i++) {

        var pokemon = nearbyPokemons[i];
        var img = $('<img/>')
            .attr('src', '/assets/images/pokemons/' + pokemon.num + '.png')
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
        spawnMarkers = limitMarkers(spawnMarkers, 500);
    }

    //mapHistory.push(objects);

};

var updateOdometer = function (km) {

    $('.distance-so-far').text((km / 1000).toFixed(3));

};

socket.on('connect', function () {

    sendStopWalking();

    socket.on('walkedTo', function (response) {

        drawCoordinates(response);
        playerMarker.setPosition(response);
        moveCircles(response);
        updateOdometer(response.kmsSoFar);

    });

    socket.on('hatchedEgg', function (response) {

        console.log(response);
        updatePlayerStatus(response);

    });

    socket.on('levelUpRewards', function (response) {

        console.log(response);

    });

    socket.on('populateMap', function (objects) {

        populateMap(objects);

    });

});

var initMap = function () {
    map = new google.maps.Map($('.map-placeholder')[0], {
        center: latLng,
        zoom:   14
    });
};

var initCircles = function () {
    radarCircle = new google.maps.Circle({
        strokeWeight: 0,
        fillColor:    '#FF0000',
        fillOpacity:  0.1,
        map:          map,
        radius:       200,
        clickable:    false
    });

    pokemonInteractionCircle = new google.maps.Circle({
        strokeWeight: 0,
        fillColor:    '#FF0000',
        fillOpacity:  0.1,
        map:          map,
        radius:       70,
        clickable:    false
    });

    interactionCircle = new google.maps.Circle({
        strokeWeight: 0,
        fillColor:    '#FF0000',
        fillOpacity:  0.1,
        map:          map,
        radius:       40,
        clickable:    false
    });
};

var botLogin = function () {
    $.ajax({
        method:      'GET',
        url:         '/amilogged/pokemonGo',
        contentType: 'application/json',
        dataType:    'json'
    }).success(function (result) {

        var latLng = {lat: result.location.lat, lng: result.location.lng};

        marker.setPosition(latLng);
        moveCircles(latLng);

    });
};

var initPlayerMarker = function () {

    var playerMarkerImage = {
        url:        '/assets/images/pokemarker.png',
        size:       new google.maps.Size(179, 250),
        origin:     new google.maps.Point(0, 0),
        anchor:     new google.maps.Point(15, 40),
        scaledSize: new google.maps.Size(29, 40)
    };

    playerMarker = new google.maps.Marker({
        icon:   playerMarkerImage,
        zIndex: 100
    });

};

var initBotMarker = function () {
    marker = new google.maps.Marker({
        map: map
    });
};

var initDestinationPointMarker = function () {
    destinationPoint = new google.maps.Marker({
        position: latLng,
        icon:     {
            path:  google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 2
        },
        zIndex:   1
    });
};

var initBackpack = function () {
    var $backpackButton = $('.backpack-button');
    var $backpack = $('.backpack-wrapper');

    $backpackButton.on('click', function () {
        $backpack.addClass('open');
    });

    $backpack.find('.close').on('click', function () {
        $backpack.removeClass('open');
    });
};

var initPokemonList = function () {
    var $pokemonButton = $('.pokemon-button');
    var $pokemonsWrapper = $('.pokemons-wrapper');
    var $pokemonsDetailsWrapper = $('.pokemon-details-wrapper');
    var $incubatorsLayer = $('.incubators-layer');

    $pokemonButton.on('click', function () {
        $pokemonsWrapper.addClass('open');
    });

    $pokemonsWrapper.find('.close').first().on('click', function () {
        $pokemonsWrapper.removeClass('open');
    });

    $pokemonsDetailsWrapper.find('.close').on('click', function () {
        $pokemonsDetailsWrapper.removeClass('open');
    });

    $incubatorsLayer.find('.close').first().on('click', function () {
        $incubatorsLayer.removeClass('open');
    });

};

$(document).ready(function () {

    $('.nearby-wrapper .bot-timer').TimeCircles({
        start:           false,
        total_duration:  10,
        count_past_zero: false,
        time:            {
            Days:    {
                show: false
            },
            Hours:   {
                show: false
            },
            Minutes: {
                show: false
            },
            Seconds: {
                text:  'next scan:',
                color: '#FF9999',
                show:  true
            }
        }
    });

    initMap();
    initBotMarker();
    initCircles();
    botLogin();

    initPlayerMarker();
    initDestinationPointMarker();

    $.ajax({
        method:      'GET',
        url:         '/amilogged/externalPlayer',
        contentType: 'application/json',
        dataType:    'json'
    }).success(function (result) {

        afterLogin(result);

    }).fail(function () {

    });

    initMapMouseInterations();
    initBackpack();
    initPokemonList();
    $('.logout').on('click', logout);

});