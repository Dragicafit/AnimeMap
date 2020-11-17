"use strict";

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
import * as jsts from "jsts";
import colormap from "colormap";
import io from "socket.io-client";
import Chart from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
Chart.plugins.unregister(ChartDataLabels);

let ratio = 10;
let nshades = 10;
let mapUrl =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson";

const ramp = colormap({
  colormap: "autumn",
  nshades: nshades,
  format: "rgbaString",
}).reverse();

var colors = [
  ramp,
  "rgba(50,50,50,1)",
  [
    "rgba(255,255,255,1)",
    "rgba(255,223,191,1)",
    "rgba(255,191,127,1)",
    "rgba(255,159,64,1)",
    "rgba(255,127,0,1)",
  ],
  "rgba(0,0,255,1)",
  "rgba(255,255,0,1)",
  "rgba(255,0,255,1)",
  "rgba(0,255,255,1)",
  "rgba(255,255,255,1)",
];

function getColor(decalage, i) {
  if (typeof colors[i] === "string") return colors[i];
  let color = Math.floor((colors[i].length * decalage) / 100);
  return colors[i][Math.min(Math.max(color, 0), colors[i].length - 1)];
}

let countryColors = {};

let socket = io.connect("http://127.0.0.1:5000/");

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

let styleCamembert = new Style({
  fill: new Fill(),
});

let styleCountry = new Style({
  fill: new Fill(),
  stroke: new Stroke({
    color: "rgba(255, 0, 255, 1)",
    width: 0.5,
  }),
  text: new Text({
    offsetY: 2,
    font: "12px Calibri,sans-serif",
    fill: new Fill({
      color: "#fff",
    }),
    stroke: new Stroke({
      color: "#000",
      width: 0.1,
    }),
    overflow: true,
  }),
});

var sourceTest = new VectorSource();

var source = new VectorSource();

socket.emit("request", (data) => {
  if (data == null) return;

  let lengend = {};
  for (let i = 0; i <= data.locations.Total; i++) {
    lengend[i] = {
      color: getColor(Math.round((100 * i) / data.locations.Total), 0),
      data: 1,
    };
  }
  new Chart("myLegend", {
    type: "horizontalBar",
    data: {
      labels: Object.keys(lengend),
      datasets: [
        {
          barThickness: 1,
          data: Object.values(lengend).map((value) => value?.data),
          backgroundColor: Object.values(lengend).map((value) => value?.color),
        },
      ],
    },
    options: {
      devicePixelRatio: ratio,
      maintainAspectRatio: false,
      legend: {
        display: false,
      },
      scales: {
        yAxes: [
          {
            position: "right",
            gridLines: {
              drawBorder: false,
              display: false,
            },
            ticks: {
              callback: function (value, index, values) {
                if (0 == index % Math.floor((values.length * 2) / nshades)) {
                  return value;
                }
              },
              maxRotation: 0,
              minRotation: 0,
              beginAtZero: true,
              autoSkip: false,
            },
          },
        ],
        xAxes: [
          {
            display: false,
            ticks: {
              max: 1,
              min: 0,
            },
          },
        ],
      },
      layout: {
        padding: {
          right: 15,
        },
      },
    },
  });
  fetch(mapUrl)
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

      new Chart("myChart", {
        plugins: [ChartDataLabels],
        type: "horizontalBar",
        data: {
          labels: Object.keys(data.locations).map(
            (key) =>
              countryColors[key]?.name ??
              (key == "ZZ" ? "Unknown Territory" : key)
          ),
          datasets: [
            {
              label: "Not present on the map",
              barThickness: 7,
              minBarLength: 2,
              data: Object.values(data.locations),
              fill: false,
              backgroundColor: Object.keys(data.locations).map(
                (key) => countryColors[key]?.color
              ),
            },
          ],
        },
        options: {
          devicePixelRatio: ratio,
          maintainAspectRatio: false,
          scales: {
            xAxes: [
              {
                ticks: { beginAtZero: true },
                scaleLabel: {
                  display: true,
                  labelString: "number of anime",
                },
              },
            ],
            yAxes: [
              {
                gridLines: {
                  display: false,
                },
                ticks: {
                  autoSkip: false,
                  fontSize: 7,
                },
              },
            ],
          },
          plugins: {
            datalabels: {
              anchor: "end",
              align: "right",
              offset: 2,
              font: {
                size: 7,
              },
            },
          },
        },
      });
    });
});

function processFeature(feature, locations) {
  let data = locations[feature.values_.iso_a2];
  if (data == null || feature.values_.iso_a2 == "I T") return;

  /*
  let max = Math.max(...Object.values(locations));
  let geo = feature.getGeometry(); 
  if (geo.getType() === "MultiPolygon") {
    var newGeo = [];
    for (let p of geo.getPolygons()) {
      try {
        let multiPolys = addPoly(p, [data / max]);
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
    var newGeo = addPoly(geo, [data / max]);
  }
  feature.setGeometry(new GeometryCollection([...newGeo, geo ]));
  feature.set("decalage", Math.round((100 * data) / max));*/
  console.log(feature.values_);
  countryColors[feature.values_.iso_a2] = {
    color: getColor(Math.round((100 * data) / locations.Total), 0),
    decalage: Math.round((100 * data) / locations.Total),
    name: feature.values_.name,
  };
  source.addFeature(feature);
}
/**
 * @param {Polygon} polygon
 * @param {Polygon} polygon
 */
/*
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
*/
let vectorLayer = new VectorLayer({
  source: source,
  style: function (feature) {
    /*
    let geometries = feature.getGeometry().getGeometries();
    let decalage = feature.get("decalage");*/
    let styleOut = []; /*
    for (let i = 0; i < geometries.length - 1; i++) {
      let newStyle = styleCamembert.clone();
      newStyle.setGeometry(geometries[i]);
      newStyle.getFill().setColor(getColor(decalage, i));
      styleOut.push(newStyle);
    }*/
    let newStyle = styleCountry.clone();
    newStyle.setGeometry(
      feature.getGeometry() /*geometries[geometries.length - 1]*/
    );
    newStyle.getFill().setColor(countryColors[feature.values_.iso_a2].color);
    newStyle
      .getText()
      .setText(`${countryColors[feature.values_.iso_a2].decalage}%`);
    var zoom = map.getView().getZoom() ** 3 * 0.4;
    var size = `${zoom}px Calibri,sans-serif`;
    newStyle.getText().setFont(size);
    styleOut.push(newStyle);
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
    url: mapUrl,
    format: new GeoJSON(),
  }),
  visible: true,
  style: new Style({
    fill: new Fill({
      color: "rgba(200,200,200,1)",
    }),
    stroke: new Stroke({
      color: "#3399CC",
      width: 0.2,
    }),
  }),
});

let test = new VectorLayer({
  source: sourceTest,
  visible: true,
});

let map = new Map({
  layers: [backgroud, vectorLayer /*, test*/],
  target: "map",
  view: new View({
    center: [1280000, 4000000],
    zoom: 1,
  }),
  pixelRatio: ratio,
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
