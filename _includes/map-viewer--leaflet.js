var x = 0;

var map = new L.map('map', {
  center: {% if page.center %}{{page.center}}{% else %}[39,-82]{% endif %},
  zoom: {% if page.zoom %}{{page.zoom}}{% else %}10{% endif %},
  fullscreenControl: true,
});

L.hash(map);

var esriOrtho = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

var esriTrans = L.tileLayer('http://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}');

var esriPlaces = L.tileLayer('http://server.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}');

var basemaps = [];
var mapLayers = [];
basemaps.ortho = L.layerGroup([esriOrtho, esriTrans, esriPlaces]);

basemaps.light = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
  subdomains: 'abcd',
  maxZoom: 19
});

basemaps.streets = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, Tiles courtesy of <a href="http://hot.openstreetmap.org/" target="_blank">Humanitarian OpenStreetMap Team</a>'
});

var baseLayers = {
  "Streets": basemaps.streets,
  "Ortho": basemaps.ortho,
  "Light": basemaps.light
};

var layerControl = new L.control.layers(baseLayers, null).addTo(map);

{% if page.basemap %}

var currentBasemap = "{{page.basemap}}";
basemaps[currentBasemap].addTo(map);

{%else%}

var currentBasemap = "streets";
basemaps["streets"].addTo(map);

{% endif %}

/*info window*/
var info = L.control({
  position: 'topleft'
});

info.onAdd = function(map) {

  this._div = L.DomUtil.create('div', 'info parcels');
  this.update();
  return this._div;
};

info.update = function(properties) {
  this._div.innerHTML = {% if page.layer.infowindow %}{{page.layer.infowindow}}{% else %}'<h3>Parcel Info</h3>' + (properties ?
    '<strong>'+ properties['OWNER'] +
    '<br />' + properties['LOCADDR'] +
    '</strong><br />' + properties['PIN']  +
    '<br />' + properties['LEGDESC'] +
    '<br />' + properties['MAILADDR'] +
    '<br />' + properties['AAREAACR'] + 'ac': "");
{% endif %}
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
/* end info box*/


/*layers and search */

/* highlight features*/
var polygonHighlight = new L.geoJSON().addTo(map);
var pointHighlight = new L.geoJSON(null, {
  pointToLayer: function(feature, latlng) {
    return L.circleMarker(latlng, {
      radius: 15,
      fillOpacity: 0.2,
      color: "red",
      fillColor: "red",
      pane: "markerPane"
    });
  },
  onEachFeature: function(feature, point) {
    var popupText = "";
    for (var k in feature.properties) {
      console.log(k);
      var v = String(feature.properties[k]);
      if (k === "FID" || k === "Shape") {}
      else{
        popupText += '<strong>' + k + '</strong><br>' + v + '<br>' + '<hr style="margin:5px 0px;">';
      }
    };
    point.bindPopup(popupText)
  }
}).addTo(map);

{% if page.layers %}
{% for layer in page.layers %}
{% assign words = layer.name | split: ' ' %}
{% capture layername %}{% for word in words %}{{ word | capitalize }}{% endfor %}{%endcapture%}

var {{layername}}Id = 0;
var {{layername}}Style = {
  color: {% if layer.color %}"{{layer.color}}"{% else%}"skyblue"{%endif%},
  fillColor: {% if layer.color %}"{{layer.fill}}"{% else%}"skyblue"{%endif%},
  weight: {% if layer.weight %}{{layer.weight}}{% else%}4{%endif%}
};

{% if layer.type == 'esrimapservice' %}

var {{layername}}Url = "{{layer.url}}";
var {{layername}} = L.esri.dynamicMapLayer({
  url: {{layername}}Url,
  opacity: 0.7
  {% if layer.minZoom %},minZoom:{{layer.minZoom}}{% endif %}
  /* could add more options here*/
}){% if layer.show == true %}.addTo(map);{% else %};{% endif %}
layerControl.addOverlay({{layername}}, "{{layer.name}}")

/*add parcel interaction esri-leaflet function*/
map.on('click', function(e) {
  if (x == 1) {
    return false
  }
  pointHighlight.clearLayers();
  polygonHighlight.clearLayers();
  if (map.hasLayer({{layername}})) {
    {{layername}}.identify().on(map).at(e.latlng).run(function(error, featureCollection) {
      if (featureCollection.features.length > 0) {
        {% if layer.geometry == "point" %}
        pointHighlight.addData(featureCollection.features[0]);
        pointHighlight.eachLayer(function(layer) {
          layer.openPopup()
        })
      {% else %}
        polygonHighlight.addData(featureCollection.features[0]);
        info.update(featureCollection.features[0].properties);
      {% endif %}
      }
    });
  }
});

{% if layer.search %}
var arcgisOnline = L.esri.Geocoding.arcgisOnlineProvider();
var results = [{% for result in layer.search.results %}"{{result}}"{% unless forloop.last %},{% endunless %}{%endfor%}];

var searchControl = L.esri.Geocoding.geosearch({
  providers: [
    arcgisOnline,
    L.esri.Geocoding.mapServiceProvider({
      label: 'Parcels',
      url: '{{layer.url}}',
      layers: [{{layer.search.layerid}}],
      searchFields: [{{layer.search.fields}}],
      formatSuggestion: function(feature) {
        var hint = "";
        for (var i = 0; i < results.length; i++) {
          if (feature.properties[results[i]]) {
            hint += feature.properties[results[i]];
            if (i <results.length){hint += '<br>'}
          }
        }
        return hint;
      }
    })
  ]
}).addTo(map);

searchControl.on('results', function(e) {
  if (map.hasLayer(polygonHighlight)) {
    polygonHighlight.clearLayers();
  }
  polygonHighlight.addData(e.results[0].geojson);
});
{% endif %}/*end search if statement*/

{% elsif layer.type =='file' %}
/* add normal leaflet layer*/
{{layername}} = new L.geoJson(null, {
  //style: {{layername}}Style,
  onEachFeature: function(feature, shape) {
    {% if layer.popup != false%}
    var popupText = "";
    for (var k in feature.properties) {
      var v = String(feature.properties[k]);
      popupText += '<strong>' + k + '</strong><br>' + v + '<br>' + '<hr style="margin:5px 0px;">';
    };
    shape.bindPopup(popupText);
    {% elsif layer.popup %}shape.bindPopup({% for field in layer.popup %}feature.properties["{{field}}"] + '<br />'{% unless forloop.last %}+{% endunless %}{%endfor%});{% endif%}
    {% if layer.tooltip %}shape.bindTooltip({% for tip in layer.tooltip %}feature.properties["{{tip}}"] + '<br />'{% unless forloop.last %}+{% endunless %}{%endfor%}, {
      sticky: true
    });{%endif%}
  }
}){% if layer.show == true %}.addTo(map);{% else %};{% endif %}

var {{layername}}Data = omnivore.{{layer.format}}('{{layer.url}}', null, {{layername}});
layerControl.addOverlay({{layername}}, "{{layer.name}}")
{%endif%}/* end if layer statement*/

{%endfor%} /*end for loop layers */
{% endif %}

/*add legend built in leaflet dom function*/
{% if page.legend %}
var legend = L.control({
  position: 'bottomright'
});

legend.onAdd = function(map) {

  var div = L.DomUtil.create('div', 'info legend');
  /* loop through our density intervals and generate a label with a colored square for each interval*/
  div.innerHTML = '{{page.legend}}';

  return div;
};

legend.addTo(map);
{% endif %}
