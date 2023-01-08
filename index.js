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
  Total: 1295,
  "United States": 1162,
  Canada: 1159,
  "United Kingdom": 948,
  Ireland: 945,
  "New Zealand": 893,
  Australia: 892,
  "South Africa": 865,
  Haiti: 834,
  Sweden: 830,
  Norway: 828,
  Denmark: 828,
  Colombia: 814,
  Honduras: 814,
  Paraguay: 814,
  Venezuela: 814,
  Brazil: 814,
  Mexico: 814,
  "Dominican Rep.": 814,
  Nicaragua: 814,
  Ecuador: 814,
  Chile: 814,
  Peru: 814,
  Bolivia: 814,
  "El Salvador": 813,
  Guatemala: 813,
  Panama: 813,
  "Costa Rica": 813,
  Finland: 808,
  Netherlands: 791,
  Iceland: 753,
  Turkey: 684,
  Bulgaria: 662,
  Slovakia: 662,
  Hungary: 662,
  Latvia: 662,
  Lithuania: 662,
  Romania: 662,
  Iraq: 662,
  Estonia: 661,
  Israel: 661,
  Egypt: 661,
  Croatia: 661,
  Libya: 660,
  Poland: 660,
  "Czech Rep.": 660,
  Ukraine: 659,
  Lebanon: 659,
  Moldova: 658,
  Greece: 657,
  Albania: 656,
  Cyprus: 655,
  Palestine: 654,
  Serbia: 654,
  Macedonia: 654,
  "Bosnia and Herz.": 654,
  "Saudi Arabia": 644,
  Germany: 639,
  Austria: 638,
  Switzerland: 628,
  Spain: 614,
  Guinea: 605,
  Portugal: 605,
  Madagascar: 604,
  Cameroon: 604,
  Nigeria: 604,
  Uganda: 603,
  Kenya: 603,
  Ghana: 603,
  Malawi: 603,
  Azerbaijan: 591,
  Georgia: 591,
  Seychelles: 588,
  France: 539,
  Uzbekistan: 526,
  Belgium: 512,
  Italy: 501,
  "United Arab Emirates": 463,
  Argentina: 450,
  Kazakhstan: 430,
  Kyrgyzstan: 411,
  Russia: 364,
  Bangladesh: 149,
  Pakistan: 149,
  India: 148,
  Nepal: 147,
  Cambodia: 145,
  Vietnam: 145,
  "Lao PDR": 145,
  Indonesia: 144,
  Philippines: 143,
  Malaysia: 142,
  Singapore: 141,
  Thailand: 140,
  Korea: 130,
  "Hong Kong": 113,
  Taiwan: 109,
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
              barThickness: 6.5,
              minBarLength: 2,
              data: Object.values(data.locations).map((number) =>
                number === "banned" ? 0 : number
              ),
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
                console.log(
                  context.chart.data.labels[context.dataIndex] +
                    ": " +
                    value +
                    ","
                );
                if (value === 0) {
                  return "banned";
                }
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

  countryColors[feature.values_.iso_a2] = {
    color:
      data === "banned"
        ? "rgba(255,255,255)"
        : getColor(Math.round((100 * data) / maxAnime)),
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
    center: [1300000, 0],
    zoom: 1,
    projection: myProjection,
  }),
  pixelRatio: ratio,
});
