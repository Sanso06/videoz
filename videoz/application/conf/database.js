/**
 * MySQL connection pool shared by every route in the application.
 *
 * A pool is used instead of a single connection so that concurrent requests
 * do not have to wait in line for one socket, and so that a dropped
 * connection is replaced automatically.
 */
const mysql = require("mysql2");
const config = require("./config");

const pool = mysql.createPool({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

// Promise-based wrapper so routes can use async/await.
const db = pool.promise();

module.exports = db;
