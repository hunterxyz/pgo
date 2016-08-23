var GeoHelper = function () {

    this.radius = 6371 * 1000;

};

GeoHelper.prototype.deg2rad = function (deg) {
    return deg * (Math.PI / 180)
};

GeoHelper.prototype.kmh2ms = function (kmh) {
    return kmh * 1000/3600
};

GeoHelper.prototype.getBearing = function (lat1, lng1, lat2, lng2) {

    var φ1 = lat1.toRadians();
    var φ2 = lat2.toRadians();
    var Δλ = (lng2 - lng1).toRadians();

    // see http://mathforum.org/library/drmath/view/55417.html
    var y = Math.sin(Δλ) * Math.cos(φ2);
    var x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    var θ = Math.atan2(y, x);

    return (θ.toDegrees() + 360) % 360;

};

GeoHelper.prototype.getDistance = function (lat1, lng1, lat2, lng2) {

    var earthRadius = this.radius; // Radius of the earth in meters

    var dLat = this.deg2rad(lat2 - lat1);  // deg2rad below
    var dlng = this.deg2rad(lng2 - lng1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
        Math.sin(dlng / 2) * Math.sin(dlng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var distance = earthRadius * c; // Distance in meters

    return distance;

};

GeoHelper.prototype.getDestinationPoint = function (lat, lng, distance, bearing) {

    var radius = this.radius;

    // φ2 = asin( sinφ1⋅cosδ + cosφ1⋅sinδ⋅cosθ )
    // λ2 = λ1 + atan2( sinθ⋅sinδ⋅cosφ1, cosδ − sinφ1⋅sinφ2 )
    // see http://williams.best.vwh.net/avform.htm#LL

    var δ = Number(distance) / radius; // angular distance in radians
    var θ = Number(bearing).toRadians();

    var φ1 = lat.toRadians();
    var λ1 = lng.toRadians();

    var φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    var x = Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2);
    var y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
    var λ2 = λ1 + Math.atan2(y, x);

    return {lat: φ2.toDegrees(), lng: (λ2.toDegrees() + 540) % 360 - 180}; // normalise to −180..+180°
};

module.exports = new GeoHelper();