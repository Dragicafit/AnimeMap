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
  Total: 1841,
  "United States": 1701,
  Canada: 1694,
  "United Kingdom": 1393,
  Venezuela: 1388,
  Colombia: 1388,
  Chile: 1388,
  Peru: 1387,
  "Costa Rica": 1387,
  Panama: 1387,
  Mexico: 1386,
  Argentina: 1386,
  Ecuador: 1386,
  Bolivia: 1385,
  Brazil: 1381,
  Ireland: 1371,
  IM: 1364,
  "Dominican Rep.": 1360,
  "New Zealand": 1355,
  Australia: 1354,
  Bahamas: 1296,
  "South Africa": 1292,
  Sweden: 1247,
  Norway: 1245,
  Denmark: 1241,
  Finland: 1240,
  Netherlands: 1192,
  Greenland: 1184,
  Iceland: 1177,
  Switzerland: 1108,
  Luxembourg: 1105,
  Germany: 1088,
  LI: 1087,
  Austria: 1083,
  Spain: 1026,
  Morocco: 1020,
  Algeria: 1020,
  Turkey: 1011,
  AD: 1006,
  Portugal: 1006,
  Belgium: 1001,
  France: 999,
  MT: 996,
  MC: 992,
  Egypt: 991,
  Libya: 989,
  Latvia: 988,
  Romania: 987,
  Ukraine: 987,
  Hungary: 986,
  Cyprus: 985,
  Lithuania: 985,
  Estonia: 985,
  Israel: 985,
  Moldova: 985,
  Slovenia: 984,
  "Czech Rep.": 984,
  Albania: 984,
  Bulgaria: 984,
  Macedonia: 984,
  Slovakia: 983,
  Serbia: 983,
  Italy: 982,
  Croatia: 982,
  "Bosnia and Herz.": 982,
  Poland: 980,
  Greece: 976,
  Belarus: 971,
  Montenegro: 971,
  "United Arab Emirates": 968,
  "Saudi Arabia": 957,
  Georgia: 933,
  Azerbaijan: 932,
  Armenia: 931,
  Nigeria: 930,
  Kenya: 929,
  Russia: 929,
  Uzbekistan: 833,
  Kazakhstan: 698,
  India: 378,
  Pakistan: 330,
  "Sri Lanka": 323,
  Bangladesh: 322,
  Philippines: 207,
  SG: 205,
  Mongolia: 177,
  Vietnam: 175,
  Indonesia: 175,
  Cambodia: 174,
  Malaysia: 173,
  Thailand: 168,
  Korea: 154,
  HK: 138,
  Taiwan: 127,
  Japan: 3,
  Iran: 0,
  China: 0,
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
