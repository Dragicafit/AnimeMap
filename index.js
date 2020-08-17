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
import { Map, View, Feature } from "ol";
import GeoJSON from "ol/format/GeoJSON";
import { Vector as VectorLayer } from "ol/layer";
import { Fill, Stroke, Style, Text } from "ol/style";
import VectorSource from "ol/source/Vector";
import * as olExtent from "ol/extent";
import * as olCoordinate from "ol/coordinate";
import * as jsts from "jsts";
import io from "socket.io-client";

let socket = io.connect("http://127.0.0.1:4000/");

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

var colors = [
  "rgba(255,0,0,1)",
  "rgba(0,255,0,1)",
  "rgba(0,0,255,1)",
  "rgba(255,255,0,1)",
  "rgba(255,0,255,1)",
  "rgba(0,255,255,1)",
  "rgba(255,255,255,1)",
];

var sourceTest = new VectorSource();

var source = new VectorSource();

socket.emit("request", (data) => {
  if (data == null) return;
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

      source.clear();
      for (let feature of features) {
        processFeature(feature, data.locations);
      }
    });
});

function processFeature(feature, locations) {
  let data = locations[feature.values_.iso_a2];
  if (data == null || feature.values_.iso_a2 != "IT") return;

  let geo = feature.getGeometry();
  if (geo.getType() === "MultiPolygon") {
    var newGeo = [];
    for (let p of geo.getPolygons()) {
      try {
        let multiPolys = addPoly(p, [
          data / Math.max(...Object.values(locations)),
        ]);
        for (let i = 0; i < multiPolys.length; i++) {
          if (newGeo[i] == null) newGeo[i] = new MultiPolygon([[[]]]);
          for (let poly of multiPolys[i].getPolygons()) {
            newGeo[i].appendPolygon(poly);
          }
        }
      } catch (error) {
        console.error(error, p);
      }
    }
  } else {
    var newGeo = addPoly(geo, [data / Math.max(...Object.values(locations))]);
  }
  feature.setGeometry(new GeometryCollection(newGeo));
  source.addFeature(feature);
}

/**
 * @param {Polygon} polygon
 * @param {Polygon} polygon
 */
function addPoly(polygon, decalages) {
  let extent = polygon.getExtent();
  let origin = [
    0,
    Math.sqrt(
      (olExtent.getTopRight(extent)[0] - olExtent.getCenter(extent)[0]) ** 2 +
        (olExtent.getTopRight(extent)[1] - olExtent.getCenter(extent)[1]) ** 2
    ) * 1.1,
  ];
  let lineStrings = [
    new LineString([
      olExtent.getCenter(extent),
      olCoordinate.add(origin.slice(), olExtent.getCenter(extent)),
    ]),
  ];
  for (let decalage of decalages) {
    olCoordinate.rotate(origin, 0.01 * Math.PI * 2);
    lineStrings.push(
      new LineString([
        olExtent.getCenter(extent),
        olCoordinate.add(origin.slice(), olExtent.getCenter(extent)),
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

  let polys = filterInside(polygonize(nodedLinework), jstsPolygon);
  let mode = null;
  for (const key in polys) {
    const poly = polys[key];
    if (poly.filtered === true) {
      mode = key;
      break;
    }
  }

  let outPut = [];
  for (let i = 0; i < lineStrings.length; i++) {
    let subPolys = polys.slice();
    if (mode === 1) {
      if (i === 0) subPolys = [subPolys[0], subPolys[1]];
      if (i === 1) subPolys = [subPolys[2], subPolys[3]];
    }
    if (mode === 2) {
      if (i === 0) subPolys = [subPolys[0], subPolys[3]];
      if (i === 1) subPolys = [subPolys[1], subPolys[2]];
    }
    if (mode === 3) {
      if (i === 0) subPolys = [subPolys[0], subPolys[2]];
      if (i === 1) subPolys = [subPolys[1], subPolys[3]];
    }
    outPut.push(
      subPolys
        .filter((poly) => poly.filtered !== true)
        .map((poly) => parser.write(poly))
    );
  }
  return polys.map((poly) => [parser.write(poly)]);
}

/**
 * @param {jsts.geom.Polygon[]} polys
 * @param {jsts.geom.Polygon} poly
 * @returns {jsts.geom.Polygon[]}
 */
function filterInside(polys, poly) {
  return polys.map((candpoly) => {
    if (!poly.contains(candpoly.getInteriorPoint())) {
      candpoly["filtered"] = true;
    }
    return candpoly;
  });
}

let backgroud = new VectorLayer({
  source: new VectorSource({
    url:
      "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson",
    format: new GeoJSON(),
  }),
  visible: true,
});

let test = new VectorLayer({
  source: sourceTest,
  visible: true,
});

let map = new Map({
  layers: [test, vectorLayer, backgroud],
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
