<script>
  var url = 'http://bhgis.org/arcgis/rest/services/aogdp/NobleParcels/MapServer';

  var cdbnolabels = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subdomains: 'abcd',
    maxZoom: 19
  });

  var osm = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, Tiles courtesy of <a href="http://hot.openstreetmap.org/" target="_blank">Humanitarian OpenStreetMap Team</a>'
  });

  var ortho = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  var trans = L.tileLayer('http://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}');

  var places = L.tileLayer('http://server.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}');

  var hybrid = L.layerGroup([ortho, trans, places]);

  var parcels, osm, baseLayers, overlays, map, searchControl, legend, info, x;

  function buildMap() {

    parcels = L.esri.dynamicMapLayer({
      url: url,
      opacity: 0.7
    });

    var oil = L.esri.dynamicMapLayer({
      url: "http://bhgis.org/arcgis/rest/services/oil/ShaleWells/MapServer"
    });

    var fema = L.esri.dynamicMapLayer({
        url: "http://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer"
    });
    baseLayers = {
      "Streets": osm,
      "Ortho": hybrid,
      "Light": cdbnolabels
    };

    overlays = {
      "Parcels": parcels,
      "Shale": oil,
      "FEMA": fema
    };

   map = L.map('map', {
            fullscreenControl: true,
			center: [39.75, -81.5],
			zoom: 10,
			layers: [cdbnolabels, parcels]
    });

    L.control.layers(baseLayers, overlays).addTo(map);
    var parcelHighlight = new L.geoJSON().addTo(map);
    var oilHighlight = L.geoJson(null, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 15,
          fillOpacity: 0.2,
          color: "red",
          fillColor: "red",
          pane: "markerPane"
        })
      },
      onEachFeature: function(feature, well) {
        well.bindPopup(well.feature.properties["WellNameAn"] + "<br>" + well.feature.properties.Operator)
      }
    }).addTo(map);
    var pane = document.getElementById('selectedFeatures');

    /*add parcel info control*/
    info = L.control({
      position: 'topleft'
    });

    info.onAdd = function(map) {

      this._div = L.DomUtil.create('div', 'info parcels');
      //div.innerHTML = '<h2>Parcel Info</h2>';
      this.update();
      return this._div;
    };

    // method that we will use to update the control based on feature properties passed
    info.update = function(properties) {
      this._div.innerHTML = '<h3>Parcel Info</h3>' + (properties ?
        '<strong>'+ properties['OWNER'] +
        '<br />' + properties['LOCADDR'] +
        '</strong><br />' + properties['PIN']  +
        '<br />' + properties['LEGDESC'] +
        '<br />' + properties['MAILADDR'] +
        '<br />' + properties['AAREAACR'] + 'ac': "");
    };


    info.addTo(map);

    info.getContainer().addEventListener('click', function() {
      event.preventDefault();
      return false
    });

    info.getContainer().addEventListener('mouseover', function (e) {
      x = 1;
      map._handlers.forEach(function(handler) {
          handler.disable();
      });
    });

    info.getContainer().addEventListener('mouseout', function () {
      x = 0;
      map._handlers.forEach(function(handler) {
        handler.enable();
      });
    });
    var div = L.DomUtil.get(info);

    if (!L.Browser.touch) {
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.on(div, 'mousewheel', L.DomEvent.stopPropagation);
    } else {
        L.DomEvent.on(div, 'click', L.DomEvent.stopPropagation);
    }

    /*add parcel interaction esri-leaflet function*/
    map.on('click', function(e) {
      if (x == 1) {
        return false
      }
      pane.innerHTML = 'Loading...';
      if (parcelHighlight) {
        parcelHighlight.clearLayers();
      }
      if (map.hasLayer(parcels)) {
        parcels.identify().on(map).at(e.latlng).run(function(error, featureCollection) {
          // make sure at least one feature was identified.
          if (featureCollection.features.length > 0) {
            parcelHighlight.addData(featureCollection.features[0]);
            /*console.log(parcelHighlight);*/
            info.update(featureCollection.features[0].properties);
            pane.innerHTML = '';
          } else {
            pane.innerHTML = 'No features identified.';
          }
        });
      }
      if (map.hasLayer(oil)) {
        oilHighlight.clearLayers();
        oil.identify().on(map).at(e.latlng).run(function(error, featureCollection) {
          /* make sure at least one feature was identified.*/
          if (featureCollection.features.length > 0) {
/*            console.log(featureCollection.features[0]);*/
            oilHighlight.addData(featureCollection.features[0]);
            oilHighlight.eachLayer(function(layer) {
              layer.openPopup()
            })
          }
        });
      }
    });

    oilHighlight.on('popupclose', function() {
      oilHighlight.clearLayers();
    });

    parcels.on('loading', function() {
      pane.innerHTML = 'Loading...';
    });
    parcels.on('load', function() {
      pane.innerHTML = ''
    });

    /*add esri search*/
    var arcgisOnline = L.esri.Geocoding.arcgisOnlineProvider();
    searchControl = L.esri.Geocoding.geosearch({
      providers: [
        arcgisOnline,
        L.esri.Geocoding.mapServiceProvider({
          label: 'Parcels',
          url: url,
          layers: [4],
          searchFields: ['OWNER', 'PIN', 'LOCADDR'],
          formatSuggestion: function(feature) {
            return feature.properties.OWNER + '<br>' + feature.properties.PIN;
          }
        })
      ]
    }).addTo(map);

    searchControl.on('results', function(e) {
      /*console.log(e);*/
      /*console.log(e.results[0].geojson);*/
      if (map.hasLayer(parcelHighlight)) {
        parcelHighlight.clearLayers();
      }
      parcelHighlight.addData(e.results[0].geojson);
    });

    /*add legend built in leaflet dom function*/
    legend = L.control({
      position: 'bottomright'
    });

    legend.onAdd = function(map) {

      var div = L.DomUtil.create('div', 'info legend');
      /* loop through our density intervals and generate a label with a colored square for each interval*/
      div.innerHTML = '<h3>Public Use Codes</h3><i style="background:purple;"></i>&nbspFederal&nbsp;<i style="background:green;"></i>&nbsp;State';

      return div;
    };

    legend.addTo(map);

  }

  /*load map after page load*/
  function checkWindowLoad(func) {
    var oldOnLoad = window.onload;
    if (typeof window.onload != 'function') {
      window.onload = func
    } else {
      window.onload = function() {
        oldOnLoad();
        func();
      }
    }
  }

  checkWindowLoad(function() {
    buildMap();
    console.log('building map');
  });
</script>
