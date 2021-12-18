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
import Projection from "ol/proj/Projection";
import { register } from "ol/proj/proj4";
import proj4 from "proj4";
Chart.plugins.unregister(ChartDataLabels);

proj4.defs(
  "ESRI:54030",
  "+proj=robin +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
);
register(proj4);

var myProjection = new Projection({
  code: "ESRI:54030",
  extent: [0, 0, 0, 12000000],
});

const ratio = 5;
const nshades = 10;
const mapUrl = "ne_110m_admin_0_countries.geojson";

const previous = {
  Total: 1134,
  "United States": 1077,
  Canada: 1069,
  "United Kingdom": 875,
  Ireland: 858,
  Australia: 816,
  "South Africa": 773,
  Norway: 749,
  Sweden: 746,
  Ecuador: 738,
  Colombia: 738,
  Mexico: 735,
  Peru: 729,
  Chile: 729,
  Nicaragua: 727,
  Finland: 726,
  Venezuela: 724,
  "Dominican Rep.": 724,
  Honduras: 724,
  "Costa Rica": 724,
  Brazil: 724,
  Bolivia: 724,
  "Puerto Rico": 715,
  Netherlands: 715,
  Turkey: 606,
  "Czech Rep.": 577,
  Ukraine: 576,
  Bulgaria: 575,
  Romania: 574,
  Egypt: 568,
  Poland: 566,
  Yemen: 566,
  Hungary: 566,
  Iraq: 565,
  Libya: 565,
  Slovakia: 565,
  Lithuania: 564,
  Moldova: 561,
  Albania: 560,
  Lebanon: 559,
  Belarus: 559,
  "Bosnia and Herz.": 559,
  Serbia: 559,
  Palestine: 558,
  Nigeria: 527,
  Spain: 521,
  Angola: 514,
  Kenya: 513,
  Botswana: 513,
  Tanzania: 512,
  Uganda: 512,
  Malawi: 512,
  Ghana: 512,
  Georgia: 493,
  Armenia: 491,
  Germany: 446,
  France: 441,
  Switzerland: 438,
  Tajikistan: 436,
  Austria: 434,
  Uzbekistan: 431,
  Luxembourg: 425,
  Belgium: 418,
  Italy: 403,
  Argentina: 378,
  "United Arab Emirates": 376,
  Kazakhstan: 367,
  Kyrgyzstan: 353,
  Russia: 270,
  Afghanistan: 167,
  Pakistan: 144,
  Bangladesh: 144,
  India: 143,
  Nepal: 143,
  Cambodia: 143,
  Vietnam: 143,
  Mongolia: 141,
  Indonesia: 141,
  Philippines: 140,
  Malaysia: 139,
  Singapore: 138,
  Thailand: 138,
  Korea: 128,
  "Hong Kong": 108,
  Taiwan: 104,
  Japan: 2,
};

const ramp = [
  "rgba(255,74,0)",
  "rgba(255,91,19)",
  "rgba(255,108,38)",
  "rgba(255,126,57)",
  "rgba(255,145,77)",
  "rgba(255,164,98)",
  "rgba(255,183,119)",
  "rgba(255,202,140)",
  "rgba(255,220,160)",
  "rgba(255,238,180)",
].reverse();

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

  const maxAnime = Math.floor((data.locations.US - 1) / 100 + 1) * 100;
  const totalAnime = data.locations.Total;

  let legend = [];
  for (let i = 0; i <= maxAnime; i++) {
    legend.push(getColor(Math.round((100 * i) / maxAnime)));
  }
  new Chart("myLegend", {
    type: "horizontalBar",
    data: {
      labels: Object.keys(legend).reverse(),
      datasets: [
        {
          barThickness: 1,
          data: legend.map(() => 1),
          backgroundColor: legend.reverse(),
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
        featureProjection: myProjection,
      });

      source.clear();
      for (let feature of features) {
        processFeature(feature, data.locations, maxAnime);
      }

      new Chart("myChart", {
        plugins: [ChartDataLabels],
        type: "horizontalBar",
        data: {
          labels: Object.keys(data.locations).map(
            (key) => countryColors[key]?.name ?? key
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
              formatter: function (value, context) {
                return `${value} ${processDiff(
                  value - previous[context.chart.data.labels[context.dataIndex]]
                )}`;
              },
            },
          },
          legend: {
            display: false,
          },
        },
      });
    });
});

function processDiff(value) {
  if (isNaN(value)) {
    return "";
  }
  if (value > 0) {
    return `(+${value})`;
  }
  if (value == 0) {
    return `(=)`;
  }
  if (value < 0) {
    return `(${value})`;
  }
}

function processFeature(feature, locations, maxAnime) {
  let data = locations[feature.values_.iso_a2];
  if (data == null) return;

  console.log(feature.values_);
  countryColors[feature.values_.iso_a2] = {
    color: getColor(Math.round((100 * data) / maxAnime)),
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
    center: [0, 0],
    zoom: 1,
    projection: myProjection,
  }),
  pixelRatio: ratio,
});
