#!/usr/bin/env node
"use strict";

require("dotenv").config();

const io = require("socket.io")();
const mysql = require("mysql");
const port = process.env.PORT || 5000;

const MYSLQ_HOST = process.env.MYSLQ_HOST;
const MYSLQ_USER = process.env.MYSLQ_USER;
const MYSLQ_PASSWORD = process.env.MYSLQ_PASSWORD;
const MYSLQ_DATABASE = process.env.MYSLQ_DATABASE;

process.title = "AnimeMap";

let con = mysql.createPool({
  connectionLimit: 10,
  host: MYSLQ_HOST,
  user: MYSLQ_USER,
  password: MYSLQ_PASSWORD,
  database: MYSLQ_DATABASE,
});

io.listen(port);
io.origins("*:*");

io.on("connection", (socket) => {
  socket.on("request", (callback) => {
    console.log("request");
    let sql = "SELECT Location, Nb FROM locations ORDER BY Nb DESC";
    con.query(sql, function (err, result) {
      if (err) return console.error(err);
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
    });
  });
});
