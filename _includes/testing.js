
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

{% if layer.type == 'vectorgrid' %}

/*vector grid instead of normal leaflet layer*/
map.createPane('vtpane');
map.getPane('vtpane').style.zindex = 240;
var {{layername}}Data = omnivore.{{layer.format}}('{{layer.url}}');
{{layername}}Data.on('ready', function() {
  var {{layername}}GeoJSON = {{layername}}Data.toGeoJSON();
  var gridIndex = 0;
  {{layername}}GeoJSON.features.map(function(feature) {
    gridIndex = gridIndex + 1;
    feature.properties.gridIndex = gridIndex;
    return feature
  });
  mapLayers["{{layername}}"] = L.vectorGrid.slicer({{layername}}GeoJSON, {
    rendererFactory: L.canvas.tile,
    vectorTileLayerStyles: {
      sliced: {{layername}}Style
    },
    maxZoom: 22,
    interactive: true,
    getFeatureId: function(f) {
      return f.properties.gridIndex
    },
    pane: 'vtpane'
  }).addTo(map);

  mapLayers["{{layername}}"].on('click', function(e) {
    if (e.layer.feature) {
      var props = e.layer.feature.properties;
      var latlng = [e.latlng.lat,e.latlng.lng];
    }else{
      var props = e.layer.properties;
      var latlng = [Number(e.latlng.lat),Number(e.latlng.lng)];
    }
    if ({{layername}}Id != 0) {
      mapLayers["{{layername}}"].setFeatureStyle({{layername}}Id, {
        color: {{layername}}Style.color,
        weight: {{layername}}Style.weight,
      });
    }

    {{layername}}Id = props.gridIndex;
    setTimeout(function() {
      mapLayers["{{layername}}"].setFeatureStyle({{layername}}Id, {
        color: "goldenrod",
        weight: 4
      }, 100);
      /*map.openPopup(popup, latlng);*/
    });
  })
  map.on('popupclose', function() {
    mapLayers["{{layername}}"].setFeatureStyle({{layername}}Id, {
      color: {{layername}}Style.color,
      weight: {{layername}}Style.weight,
    });
    document.getElementById("mapLayerInfoWrapper").style.display = 'none';
  });
  {% if layer.search == true%}
  searchAndFit();
  {% endif %}
});

{% elsif layer.type == 'esrimapservice' %}

var {{layername}} = L.esri.dynamicMapLayer({
  url: url,
  opacity: 0.7
}).addTo(map);
layerControl.addOverlay({{layername}}, "{{layer.name}}")
{% elsif layer.type =='geojson' or layer.type == 'topojson' %}
/* add normal leaflet layer*/
mapLayers["{{layername}}"] = new L.geoJson(null, {
  style: {{layername}}Style,
  onEachFeature: function(feature, shape) {
    {% if layer.popup == 'all'%}
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
}).addTo(map);


var {{layername}}Data = omnivore.{{layer.format}}('{{layer.url}}', null, mapLayers["{{layername}}"]);
{{layername}}Data.on('ready', function() {
  searchAndFit();
})
{%endif%}/*end layer types*/

function searchAndFit() {
  {% if layer.fit == true %}map.fitBounds({{layername}}Data.getBounds());{% endif %}

  {% if layer.search and layer.search != "osm" %}
	document.getElementById('mapSearchControl').style.display = 'block';
  var prop = 'Search ' + '{{layer.name}}';
  searchControl = new L.Control.Search({
    /*can only search one layer or layer group at a time*/
    layer: {{layername}}Data,
    propertyName: "{{layer.search}}",
    container: "mapSearchControl",
    textPlaceholder: prop,
    marker: false,
    autoType: false,
    autoCollapse: false,
    minLength: 2,
    zoom:null,
    collapsed: false,
    add: false
  }).addTo(map);

  searchControl.on("search:locationfound", function(e) {
    console.log(e);
    clickedFeature.addData(e.layer.feature);
		map.flyToBounds(e.layer.getBounds());
    searchControl.collapse()
  });
  $("#searchtext" + prop.length).on('input',function() {
    $('.search-tooltip').width($('.search-tooltip').parent().width());
  });
  {% endif %}
}

{%endfor%} /*end for loop layers */
{%endif%}/* end if layer statement*/

{% if page.search %}
/*add esri search*/
var searchFields = {% for field in page.search.fields %}{{field}}{% unless forloop.last %},{% endunless %}{endfor%};
var arcgisOnline = L.esri.Geocoding.arcgisOnlineProvider();
searchControl = L.esri.Geocoding.geosearch({
  providers: [
    arcgisOnline,
    L.esri.Geocoding.{{page.search.type}}({
      label: {{page.search.label}},
      url: url,
      layers: [4],
      searchFields: searchFields,
      formatSuggestion: function(feature) {
        var p = feature.properties;
        return p.{{page.search.results[0]}} + '<br>' + p.{{page.search.results[1]}};
      }
    })
  ]
}).addTo(map);

searchControl.on('results', function(e) {
  if (map.hasLayer(parcelHighlight)) {
    parcelHighlight.clearLayers();
  }
  parcelHighlight.addData(e.results[0].geojson);
});
{% endif %}
