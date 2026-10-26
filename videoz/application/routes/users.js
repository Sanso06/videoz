const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const db = require("../conf/database");
const postQueries = require("../models/postQueries");
const UserError = require("../helpers/error/UserError");
const { successPrint, errorPrint } = require("../helpers/debug/debugprinters");
const { isLoggedIn } = require("../middleware/auth");

const SALT_ROUNDS = 12;

/* The same rules validation.js enforces in the browser, repeated here because
   client-side checks can always be bypassed. */
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{2,}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordIsStrong(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[/*\-+!@#$^&~\[\]]/.test(password)
  );
}

/**
 * FR1 - Register a new account.
 */
router.post("/register", async function (req, res, next) {
  const username = (req.body.username || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const confirmPassword = req.body.confirmPassword || "";

  try {
    if (!USERNAME_PATTERN.test(username)) {
      throw new UserError(
        "Username must start with a letter and be at least 3 letters or numbers.",
        "/registration",
        400
      );
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new UserError(
        "Please enter a valid email address.",
        "/registration",
        400
      );
    }
    if (!passwordIsStrong(password)) {
      throw new UserError(
        "Password needs 8+ characters, an uppercase letter, a number, and a special character.",
        "/registration",
        400
      );
    }
    if (password !== confirmPassword) {
      throw new UserError("Passwords do not match.", "/registration", 400);
    }

    // Reject duplicates before attempting the insert so the message is clear.
    const [existing] = await db.execute(
      "SELECT id, username, email FROM users WHERE username = ? OR email = ?",
      [username, email]
    );
    if (existing.length > 0) {
      const taken =
        existing[0].username.toLowerCase() === username.toLowerCase()
          ? "Username"
          : "Email";
      throw new UserError(`${taken} is already taken.`, "/registration", 409);
    }

    // Never store the plain-text password.
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.execute(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    successPrint(`User ${username} was created (id ${result.insertId}).`);
    req.session.flash = {
      type: "success",
      message: "Account created! You can log in now.",
    };
    return req.session.save(() => res.redirect("/login"));
  } catch (err) {
    if (!(err instanceof UserError)) errorPrint("Registration failed");
    return next(err);
  }
});

/**
 * FR2 - Log in with existing credentials.
 */
router.post("/login", async function (req, res, next) {
  const identifier = (req.body.username || "").trim();
  const password = req.body.password || "";

  try {
    if (!identifier || !password) {
      throw new UserError(
        "Please enter your username and password.",
        "/login",
        400
      );
    }

    const [rows] = await db.execute(
      "SELECT id, username, email, password FROM users WHERE username = ? OR email = ?",
      [identifier, identifier.toLowerCase()]
    );

    // Deliberately vague message: do not reveal whether the account exists.
    if (rows.length === 0) {
      throw new UserError("Invalid username or password.", "/login", 401);
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UserError("Invalid username or password.", "/login", 401);
    }

    // Regenerate the session id on login to avoid session fixation.
    req.session.regenerate(function (regenErr) {
      if (regenErr) return next(regenErr);

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
      };
      req.session.flash = {
        type: "success",
        message: `Welcome back, ${user.username}!`,
      };
      successPrint(`User ${user.username} logged in.`);
      req.session.save(() => res.redirect("/"));
    });
  } catch (err) {
    if (!(err instanceof UserError)) errorPrint("Login failed");
    return next(err);
  }
});

/**
 * FR3 - Log out. GET so a plain nav link works, POST for form submissions.
 */
function logout(req, res, next) {
  const username =
    req.session && req.session.user ? req.session.user.username : null;
  req.session.destroy(function (err) {
    if (err) return next(err);
    res.clearCookie("videoz.sid");
    if (username) successPrint(`User ${username} logged out.`);
    res.redirect("/");
  });
}

router.get("/logout", logout);
router.post("/logout", logout);

/**
 * Convenience route: /users/profile sends you to your own profile.
 */
router.get("/profile", isLoggedIn, function (req, res) {
  res.redirect(`/users/${req.session.user.id}`);
});

/**
 * FR4, FR5 - Profile page with the user's information and their posts.
 */
router.get("/:id", async function (req, res, next) {
  const userId = Number(req.params.id);

  try {
    if (!Number.isInteger(userId) || userId < 1) {
      throw new UserError("That user does not exist.", "/", 404);
    }

    const [users] = await db.execute(
      "SELECT id, username, email, createdAt FROM users WHERE id = ?",
      [userId]
    );
    if (users.length === 0) {
      throw new UserError("That user does not exist.", "/", 404);
    }
    const profileUser = users[0];

    // FR5 - the posts this user has created.
    const posts = await postQueries.findByAuthor(userId);

    const isOwnProfile =
      Boolean(req.session.user) && req.session.user.id === profileUser.id;

    res.render("profile", {
      title: `Videoz - ${profileUser.username}`,
      bannerTitle: profileUser.username,
      profileUser,
      posts,
      postCount: posts.length,
      isOwnProfile,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
