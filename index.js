import "ol/ol.css";
import Feature from "ol/Feature";
import { LineString, Point, Polygon, MultiPolygon } from "ol/geom";
import { Map, View } from "ol";
import GeoJSON from "ol/format/GeoJSON";
import MVT from "ol/format/MVT";
import VectorTileLayer from "ol/layer/VectorTile";
import { Vector as VectorLayer } from "ol/layer";
import VectorTileSource from "ol/source/VectorTile";
import { Fill, Stroke, Style, Text } from "ol/style";
import VectorSource from "ol/source/Vector";
import * as olExtent from "ol/extent";
import * as olProj from "ol/proj";
import * as olCoordinate from "ol/coordinate";
import * as jsts from "jsts";

var style = new Style({
  fill: new Fill({
    color: "rgba(255, 0, 255, 0.6)",
  }),
  stroke: new Stroke({
    color: "#319FD3",
    width: 1,
  }),
  text: new Text({
    font: "12px Calibri,sans-serif",
    fill: new Fill({
      color: "#000",
    }),
    stroke: new Stroke({
      color: "#fff",
      width: 3,
    }),
  }),
});

var source = new VectorSource({
  url:
    "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson",
  format: new GeoJSON(),
});

var exportSource = new VectorSource();

source.on("addfeature", (event) => {
  var feature = event.feature;
  var geo = feature.getGeometry();

  if (geo.getType() === "MultiPolygon") {
    var poly2 = new MultiPolygon([[[]]]);
    geo.getPolygons().forEach((p) => {
      addPoly(p);
      poly2.appendPolygon(p);
    });
    geo.setCoordinates(poly2.getCoordinates());
    return;
  }
  addPoly(geo);

  /**
   * @param {Polygon} polygon
   */
  function addPoly(polygon) {
    var extent = polygon.getExtent();

    var newpoly = new MultiPolygon([
      new Polygon([
        [
          olExtent.getTopLeft(extent),
          olCoordinate.add(olExtent.getTopLeft(extent), [
            olExtent.getWidth(extent) / 2,
            0,
          ]),
          olCoordinate.add(olExtent.getBottomLeft(extent), [
            olExtent.getWidth(extent) / 2,
            0,
          ]),
          olExtent.getBottomLeft(extent),
        ],
      ]),
      new Polygon([
        [
          olCoordinate.add(olExtent.getTopLeft(extent), [
            olExtent.getWidth(extent) / 2,
            0,
          ]),
          olExtent.getTopRight(extent),
          olExtent.getBottomRight(extent),
          olCoordinate.add(olExtent.getBottomLeft(extent), [
            olExtent.getWidth(extent) / 2,
            0,
          ]),
        ],
      ]),
    ]);
    exportSource.addFeature(new Feature(newpoly));
    polygon.setCoordinates([
      [
        olExtent.getTopLeft(extent),
        olExtent.getTopRight(extent),
        olExtent.getBottomRight(extent),
        olExtent.getBottomLeft(extent),
      ],
    ]);
  }
});

var vectorLayerExport = new VectorLayer({
  source: exportSource,
  style: function (feature) {
    style.getText().setText(feature.get("name"));
    return style;
  },
  visible: true,
});

var vectorLayer = new VectorLayer({
  source: source,
  visible: true,
});

var backgroud = new VectorLayer({
  source: new VectorSource({
    url:
      "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson",
    format: new GeoJSON(),
  }),
  visible: true,
});

var map = new Map({
  layers: [vectorLayer, vectorLayerExport, backgroud],
  target: "map",
  view: new View({
    center: [0, 0],
    zoom: 1,
  }),
});
/*
var highlightStyle = new Style({
  stroke: new Stroke({
    color: "rgba(255,0,0,0.1)",
    width: 1,
  }),
  fill: new Fill({
    color: "rgba(255,0,0,0.1)",
  }),
  text: new Text({
    font: "12px Calibri,sans-serif",
    fill: new Fill({
      color: "rgba(255,0,0,0.1)",
    }),
    stroke: new Stroke({
      color: "rgba(255,0,0,0.1)",
      width: 3,
    }),
  }),
});

// Selection
var selectionLayer = new VectorLayer({
  source: vectorLayer.getSource(),
  map: map,
  renderMode: "vector",
  style: function (feature) {
    if (feature.getId() == selection) {
      highlightStyle.getText().setText(feature.get("name"));
      return highlightStyle;
    }
  },
});

var selection = null;
var displayFeatureInfo = function (pixel) {
  vectorLayer.getFeatures(pixel).then(function (features) {
    if (!features.length) {
      selection = null;
      selectionLayer;
      selectionLayer.changed();
      return;
    }
    var feature = features[0];
    if (!feature) {
      return;
    }
    var fid = feature.getId();

    selection = fid;

    selectionLayer.changed();
  });
};

map.on(["click", "pointermove"], function (evt) {
  displayFeatureInfo(evt.pixel);
});
*/
