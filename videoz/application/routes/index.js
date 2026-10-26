const express = require("express");
const router = express.Router();

const postQueries = require("../models/postQueries");
const { errorPrint } = require("../helpers/debug/debugprinters");
const { isLoggedIn, isLoggedOut } = require("../middleware/auth");

/**
 * FR12 - Home page. Newest posts as thumbnail cards.
 */
router.get("/", async (req, res, next) => {
  try {
    const posts = await postQueries.findRecent();

    res.render("index", {
      title: "Videoz - Home",
      bannerTitle: "Videoz",
      name: "Jugaad Sarang",
      posts,
      hasPosts: posts.length > 0,
    });
  } catch (err) {
    errorPrint("Loading home feed failed");
    next(err);
  }
});

/**
 * FR10, FR11 - Search posts by title, description, or author.
 */
router.get("/search", async (req, res, next) => {
  const query = (req.query.q || "").trim();

  try {
    const posts = query.length > 0 ? await postQueries.search(query) : [];

    res.render("search", {
      title: "Videoz - Search",
      bannerTitle: "Search Results",
      query,
      posts,
      hasPosts: posts.length > 0,
      searched: query.length > 0,
      resultCount: posts.length,
    });
  } catch (err) {
    errorPrint("Search failed");
    next(err);
  }
});

/* Login page. Already-authenticated visitors are sent home. */
router.get("/login", isLoggedOut, (req, res) => {
  res.render("login", {
    title: "Videoz - Login",
    bannerTitle: "Videoz Login",
    useLoginValidation: true,
  });
});

/* Registration page. */
router.get("/registration", isLoggedOut, (req, res) => {
  res.render("registration", {
    title: "Videoz - Register",
    bannerTitle: "Register",
    useValidation: true,
  });
});

/* Upload form. Only registered users may post. */
router.get("/postvideo", isLoggedIn, (req, res) => {
  res.render("postvideo", {
    title: "Videoz - Post a Video",
    bannerTitle: "Post a New Video",
    usePostVideo: true,
  });
});

/**
 * Milestone-2 URL kept alive so old links land on the feed rather than a 404.
 */
router.get("/viewpost", (req, res) => {
  res.redirect("/");
});

module.exports = router;
