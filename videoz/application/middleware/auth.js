/**
 * Authentication middleware.
 *
 * `attachUser` runs on every request and copies the logged-in user from the
 * session onto `res.locals` so that templates can react to it without every
 * route having to pass the user in manually. It also picks up (and clears)
 * any one-time flash message left behind by a redirect.
 *
 * `isLoggedIn` guards routes that only make sense for a registered user.
 */
const UserError = require("../helpers/error/UserError");

function attachUser(req, res, next) {
  res.locals.user = req.session && req.session.user ? req.session.user : null;
  res.locals.isLoggedIn = Boolean(res.locals.user);

  if (req.session && req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  }

  next();
}

function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  next(new UserError("You must be logged in to do that.", "/login", 401));
}

/**
 * For pages a logged-in user should not see again (login / registration).
 */
function isLoggedOut(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect("/");
  }
  next();
}

module.exports = { attachUser, isLoggedIn, isLoggedOut };
