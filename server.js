#!/usr/bin/env node
"use strict";

const io = require("socket.io")();
const performance = require("perf_hooks").performance;
const mysql = require("mysql");
const port = process.env.PORT || 5000;

process.title = "AnimeMap";

let con = mysql.createPool({
  connectionLimit: 10,
  host: "localhost",
  user: "programme",
  password: "9JZojvKKQ9tEkeqk",
  database: "crunchy_data",
});

io.listen(port);
io.origins("*:*");

io.on("connection", (socket) => {
  socket.on("request", (callback) => {
    console.log("request");
    let sql =
      'SELECT Location, COUNT(*) AS Nb FROM series s1 WHERE DATEDIFF((SELECT MAX(Date) FROM series s2 where s2.Location = s1.Location), Date) < 30 GROUP BY Location UNION\
       SELECT "Total" AS Location, COUNT(DISTINCT Id) AS Nb FROM series s1 WHERE DATEDIFF((SELECT MAX(Date) FROM series s2 where s2.Location = s1.Location), Date) < 30 ORDER BY Nb DESC';
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
