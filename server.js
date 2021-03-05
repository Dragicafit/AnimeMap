#!/usr/bin/env node
"use strict";

require("dotenv").config();

const io = require("socket.io")();
const { MongoClient } = require("mongodb");
const port = process.env.PORT || 5000;

process.title = "AnimeMap";

const username = encodeURIComponent(process.env.MONGODB_USER);
const password = encodeURIComponent(process.env.MONGODB_PASSWORD);
const clusterUrl = process.env.MONGODB_CLUSTER_URL;
const client = new MongoClient(
  `mongodb://${username}:${password}@${clusterUrl}/`,
  { useNewUrlParser: true, useUnifiedTopology: true }
);

let db;
client.connect((error) => {
  if (error) throw error;

  db = client.db(process.env.MONGODB_DATABASE);
  console.log("Connected successfully to server");
});

io.listen(port);
io.origins("*:*");

io.on("connection", (socket) => {
  socket.on("request", (callback) => {
    console.log("request");
    db.collection("nb__anime_id__location")
      .find({})
      .sort({ Nb: -1 })
      .toArray()
      .then((result) => {
        if (result.length == 0) {
          return callback();
        }
        let locations = {};
        for (const line of result) {
          locations[line.Location] = line.Nb;
        }
        callback({
          locations: locations,
        });
      })
      .catch((err) => console.error(err));
  });
});
