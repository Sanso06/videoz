/**
 * Central configuration.
 *
 * Every value can be overridden with an environment variable. Set DB_PASSWORD
 * and SESSION_SECRET in your environment; no credentials are stored in source.
 * See .env.example.
 */
module.exports = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "videoz_db",

  // Signs the session cookie. The fallback keeps development logins working
  // across restarts; always set SESSION_SECRET outside local development.
  sessionSecret: process.env.SESSION_SECRET || "videoz-csc317-session-secret",

  // How long a login lasts before the browser drops the cookie (2 weeks).
  sessionMaxAge: 1000 * 60 * 60 * 24 * 14,

  // Largest video upload accepted (100 MB).
  maxUploadBytes: 100 * 1024 * 1024,
};
