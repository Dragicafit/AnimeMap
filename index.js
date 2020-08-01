import "ol/ol.css";
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
  GeometryCollection,
  Array
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

var colors = ["rgba(255,0,0,0.6)", "rgba(255,0,255,0.6)", "rgba(0,0,255,0.6)"];

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
    var newGeo = [];
    for (let p of geo.getPolygons()) {
      try {
        let multiPolys = addPoly(p);
        for (let i = 0; i < multiPolys.length; i++) {
          if (newGeo[i] == null) newGeo[i] = new MultiPolygon([[[]]]);
          for (let poly of multiPolys[i].getPolygons()) {
            newGeo[i].appendPolygon(poly);
          }
        }
      } catch (error) {
        console.log(error, p);
      }
    }
  } else {
    var newGeo = addPoly(geo);
  }
  feature.setGeometry(new GeometryCollection(newGeo));
}

/**
 * @param {Polygon} polygon
 */
function addPoly(polygon) {
  let extent = polygon.getExtent();
  let decalages = [
    olExtent.getWidth(extent) / 3,
    olExtent.getWidth(extent) / 1.5,
  ];
  let lineStrings = [];
  for (let decalage of decalages) {
    lineStrings.push(
      new LineString([
        olCoordinate.add(olExtent.getTopLeft(extent), [decalage, 0]),
        olCoordinate.add(olExtent.getBottomLeft(extent), [decalage, 0]),
      ])
    );
  }

  let split = splitPolygon(polygon, lineStrings);
  let newGeo = [];
  for (let polys of split) {
    let multiPoly = new MultiPolygon([[[]]]);
    for (let poly of polys) {
      multiPoly.appendPolygon(poly);
    }
    newGeo.push(multiPoly);
  }
  return newGeo;
}

let vectorLayer = new VectorLayer({
  source: source,
  style: function (feature) {
    let geometries = feature.getGeometry().getGeometries();
    style.getText().setText(feature.get("name"));
    let styleOut = [];
    for (let i = 0; i < geometries.length; i++) {
      let newStyle = style.clone();
      newStyle.setGeometry(geometries[i]);
      newStyle.getFill().setColor(colors[i]);
      styleOut.push(newStyle);
    }
    return styleOut;
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
 * @param {Polygon} polygon
 * @param {LineString} lineString
 * @returns {Object}
 */
function splitPolygon(polygon, lineStrings) {
  let jstsPolygon = parser.read(polygon);
  let nodedLinework = jstsPolygon.getExteriorRing();
  for (let lineString of lineStrings)
    nodedLinework = nodedLinework.union(parser.read(lineString));

  let polys = polygonize(nodedLinework);

  let outPut = [];
  for (let i = 0; i < lineStrings.length + 1; i++) {
    outPut.push(
      filterInside(
        polys.slice((i * polys.length) / 3, ((i + 1) * polys.length) / 3),
        jstsPolygon
      )
    );
  }

  return outPut;
}

/**
 * @param {jsts.geom.Polygon[]} polys
 * @param {jsts.geom.Polygon} poly
 * @returns {jsts.geom.Polygon[]}
 */
function filterInside(polys, poly) {
  return polys
    .filter((candpoly) => {
      if (poly.contains(candpoly.getInteriorPoint())) {
        return true;
      }
    })
    .map((poly) => parser.write(poly));
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
