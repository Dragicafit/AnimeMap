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
  fill: new Fill(),
  stroke: new Stroke({
    color: "rgba(255, 0, 255, 0.6)",
    width: 1,
  }),
});

var colors = [
  "rgba(255,127,0,1)",
  "rgba(50,50,50,1)",
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
  if (data == null || feature.values_.iso_a2 == "I T") return;

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
  let center = polygon.getInteriorPoint().getCoordinates();
  let origin = [
    0,
    Math.sqrt(
      (olExtent.getTopRight(extent)[0] - olExtent.getCenter(extent)[0]) ** 2 +
        (olExtent.getTopRight(extent)[1] - olExtent.getCenter(extent)[1]) ** 2
    ) * 1.1,
  ];
  let lineStrings = [
    new LineString([center, olCoordinate.add(origin.slice(), center)]),
  ];
  for (let decalage of decalages) {
    let rotation = olCoordinate.rotate(origin.slice(), -decalage * Math.PI * 2);
    lineStrings.push(
      new LineString([center, olCoordinate.add(rotation, center)])
    );
  }
  let split = splitPolygon(polygon, lineStrings);

  let newGeo = [];
  for (let i = 0; i < decalages.length + 1; i++) {
    newGeo.push(new MultiPolygon([[[]]]));
  }
  for (const poly of split) {
    let center2 = poly.getInteriorPoint().getCoordinates();
    let angle = Math.atan2(center2[0] - center[0], center2[1] - center[1]);
    if (angle < 0) {
      angle += 2 * Math.PI;
    }
    for (let i = 0; i < decalages.length + 1; i++) {
      if (i == decalages.length || angle < decalages[i] * Math.PI * 2) {
        newGeo[i].appendPolygon(poly);
        break;
      }
    }
  }
  return newGeo;
}

let vectorLayer = new VectorLayer({
  source: source,
  style: function (feature) {
    let geometries = feature.getGeometry().getGeometries();
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

  let polys = filterInside(polygonize(nodedLinework), jstsPolygon).map((poly) =>
    parser.write(poly)
  );
  return polys;
}

/**
 * @param {jsts.geom.Polygon[]} polys
 * @param {jsts.geom.Polygon} poly
 * @returns {jsts.geom.Polygon[]}
 */
function filterInside(polys, poly) {
  return polys.filter((candpoly) => {
    return poly.contains(candpoly.getInteriorPoint());
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
  layers: [backgroud, vectorLayer, test],
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
