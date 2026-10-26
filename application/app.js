const path = require("path");
const createError = require("http-errors");
const express = require("express");
const favicon = require("serve-favicon");
const logger = require("morgan");
const session = require("express-session");
const { engine } = require("express-handlebars");

const config = require("./conf/config");
const hbsHelpers = require("./helpers/handlebars/hbsHelpers");
const AppError = require("./helpers/error/AppError");
const { errorPrint } = require("./helpers/debug/debugprinters");
const { attachUser } = require("./middleware/auth");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const postsRouter = require("./routes/posts");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

/* ---------------------------------------------------------------- templating */

app.engine(
  "hbs",
  engine({
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    extname: ".hbs",
    defaultLayout: "layout",
    helpers: hbsHelpers,
  })
);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

/* --------------------------------------------------------------- middleware */

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/**
 * Session support (NFR4): keeps a user logged in across requests until they
 * log out or the cookie expires.
 *
 * Sessions are held in memory, which is fine for a single-process app but means
 * a server restart signs everyone out. Swapping in a MySQL-backed store would
 * be the fix if this ever ran for real.
 */
app.use(
  session({
    name: "videoz.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // not readable from JavaScript, blunts XSS cookie theft
      sameSite: "lax", // blocks the cookie on cross-site POSTs (CSRF defence)
      secure: isProduction, // HTTPS-only once deployed
      maxAge: config.sessionMaxAge,
    },
  })
);

// Exposes `user`, `isLoggedIn`, and any one-time flash message to every view.
app.use(attachUser);

app.use(favicon(path.join(__dirname, "public", "favicon.ico")));
app.use("/public", express.static(path.join(__dirname, "public")));

/* ------------------------------------------------------------------- routes */

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/posts", postsRouter);

// Nothing matched, so the resource does not exist.
app.use((req, res, next) => {
  next(createError(404, `The route ${req.method} : ${req.url} does not exist.`));
});

/* ------------------------------------------------------------ error handler */

/**
 * Two kinds of failure are handled differently:
 *
 * - An AppError (UserError / PostError) is something we raised on purpose, like
 *   a duplicate username. The user gets bounced back to a useful page with a
 *   readable flash message.
 * - Anything else is a genuine fault, so it renders the error page. The stack
 *   trace is attached only outside production.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    errorPrint(err.getMessage());

    if (req.session) {
      req.session.flash = { type: "error", message: err.getMessage() };
      return req.session.save(() => res.redirect(err.getRedirectURL()));
    }
    return res.redirect(err.getRedirectURL());
  }

  const status = err.status || 500;
  errorPrint(`${status} ${err.message}`);
  if (!isProduction) {
    console.error(err);
  }

  res.status(status);
  res.render("error", {
    title: "Videoz - Error",
    bannerTitle: "Something Went Wrong",
    message: err.message,
    error: {
      status,
      stack: isProduction ? null : err.stack,
    },
  });
});

module.exports = app;
