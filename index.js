import "ol/ol.css";
import Feature from "ol/Feature";
import {
  Point,
  LineString,
  LinearRing,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  GeometryCollection,
} from "ol/geom";
import { Map, View } from "ol";
import GeoJSON from "ol/format/GeoJSON";
import { Vector as VectorLayer } from "ol/layer";
import { Fill, Stroke, Style, Text } from "ol/style";
import VectorSource from "ol/source/Vector";
import * as olExtent from "ol/extent";
import * as olCoordinate from "ol/coordinate";
import * as jsts from "jsts";

let parser = new jsts.io.OL3Parser();
parser.inject(
  Point,
  LineString,
  LinearRing,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  GeometryCollection
);

let style = new Style({
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

var source = new VectorSource();
fetch(
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson"
)
  .then(function (response) {
    return response.json();
  })
  .then(function (json) {
    var format = new GeoJSON();
    var features = format.readFeatures(json, {
      featureProjection: "EPSG:3857",
    });

    for (let feature of features) {
      processFeature(feature);
    }
    source.addFeatures(features);
  });
function processFeature(feature) {
  let geo = feature.getGeometry();

  if (geo.getType() === "MultiPolygon") {
    let poly2 = new MultiPolygon([[[]]]);
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
    let extent = polygon.getExtent();

    let lineString = new LineString([
      olCoordinate.add(olExtent.getTopLeft(extent), [
        olExtent.getWidth(extent) / 2,
        0,
      ]),
      olCoordinate.add(olExtent.getBottomLeft(extent), [
        olExtent.getWidth(extent) / 2,
        0,
      ]),
    ]);

    let jstsPolygon = parser.read(polygon);
    let jstsLineString = parser.read(lineString);
    try {
      let polygons = splitPolygon(jstsPolygon, jstsLineString);
      let newpoly = parser.write(polygons);
      feature.setGeometry(newpoly);
    } catch (error) {
      console.log(error, polygon);
    }
  }
}

let vectorLayer = new VectorLayer({
  source: source,
  style: function (feature) {
    feature;
    style.getText().setText(feature.get("name"));
    return [style, style];
  },
  visible: true,
});

/**
 * @param {jsts.geom.Geometry} geometry
 * @returns {Array}
 */
function polygonize(geometry) {
  let polygonizer = new jsts.operation.polygonize.Polygonizer();
  polygonizer.add(geometry);
  let polys = polygonizer.getPolygons();
  return jsts.geom.GeometryFactory.toPolygonArray(polys);
}

/**
 * @param {jsts.geom.Polygon} poly
 * @param {jsts.geom.LineString} line
 * @returns {jsts.geom.GeometryCollection}
 */
function splitPolygon(poly, line) {
  let nodedLinework = poly.getExteriorRing().union(line);
  let polys = polygonize(nodedLinework);
  let left = filterInside(polys.slice(polys.length / 2), poly);
  let rigth = filterInside(polys.slice(polys.length / 2, polys.length), poly);

  return poly
    .getFactory()
    .createGeometryCollection([
      poly.getFactory().createMultiPolygon(left),
      poly.getFactory().createMultiPolygon(rigth),
    ]);
}

/**
 * @param {Array} polys
 * @param {jsts.geom.Polygon} poly
 * @returns {jsts.geom.Polygon}
 */
function filterInside(polys, poly) {
  return polys.filter((candpoly) => {
    if (poly.contains(candpoly.getInteriorPoint())) {
      return true;
    }
  });
}

function directionOfPoint(A, B, P) {
  let x1 = B.x - A.x;
  let y1 = B.y - A.y;
  let x2 = P.x - A.x;
  let y2 = P.y - A.y;

  return x1 * y2 - y1 * x2 > 0;
}

let backgroud = new VectorLayer({
  source: new VectorSource({
    url:
      "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson",
    format: new GeoJSON(),
  }),
  visible: true,
});

let map = new Map({
  layers: [vectorLayer, backgroud],
  target: "map",
  view: new View({
    center: [0, 0],
    zoom: 1,
  }),
});
/*
let highlightStyle = new Style({
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
let selectionLayer = new VectorLayer({
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

let selection = null;
let displayFeatureInfo = function (pixel) {
  vectorLayer.getFeatures(pixel).then(function (features) {
    if (!features.length) {
      selection = null;
      selectionLayer;
      selectionLayer.changed();
      return;
    }
    let feature = features[0];
    if (!feature) {
      return;
    }
    let fid = feature.getId();

    selection = fid;

    selectionLayer.changed();
  });
};

map.on(["click", "pointermove"], function (evt) {
  displayFeatureInfo(evt.pixel);
});
*/
