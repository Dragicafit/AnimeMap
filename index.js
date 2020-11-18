"use strict";

import "ol/ol.css";
import { Map, View } from "ol";
import GeoJSON from "ol/format/GeoJSON";
import { Vector as VectorLayer } from "ol/layer";
import { Fill, Stroke, Style, Text } from "ol/style";
import VectorSource from "ol/source/Vector";
import colormap from "colormap";
import io from "socket.io-client";
import Chart from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
Chart.plugins.unregister(ChartDataLabels);

const ratio = 5;
const nshades = 10;
const mapUrl =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson";

const ramp = colormap({
  colormap: "autumn",
  nshades: nshades,
  format: "rgbaString",
}).reverse();

function getColor(decalage) {
  let color = Math.floor((ramp.length * decalage) / 100);
  return ramp[Math.min(Math.max(color, 0), ramp.length - 1)];
}

let countryColors = {};

let socket = io.connect("http://127.0.0.1:5000/");

let styleCountry = new Style({
  fill: new Fill(),
  stroke: new Stroke({
    color: "rgba(0, 200, 200, 1)",
    width: 0.5,
  }),
});

var source = new VectorSource();

socket.emit("request", (data) => {
  if (data == null) return;

  let lengend = {};
  for (let i = 0; i <= 1100; i++) {
    lengend[i] = {
      color: getColor(Math.round((100 * i) / 1100)),
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
                if (
                  0 == index % Math.floor((values.length * 2) / nshades) ||
                  index == values.length - 1
                ) {
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
                  labelString: "number of anime available on Crunchyroll",
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
  if (data == null) return;

  console.log(feature.values_);
  countryColors[feature.values_.iso_a2] = {
    color: getColor(Math.round((100 * data) / locations.Total)),
    decalage: Math.round((100 * data) / locations.Total),
    name: feature.values_.name,
  };
  source.addFeature(feature);
}

let vectorLayer = new VectorLayer({
  source: source,
  style: function (feature) {
    let styleOut = [];
    let newStyle = styleCountry.clone();
    newStyle.setGeometry(feature.getGeometry());
    newStyle.getFill().setColor(countryColors[feature.values_.iso_a2].color);
    styleOut.push(newStyle);
    return styleOut;
  },
  visible: true,
});

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

let map = new Map({
  layers: [backgroud, vectorLayer],
  target: "map",
  view: new View({
    center: [0, 4000000],
    zoom: 1,
  }),
  pixelRatio: ratio,
});
