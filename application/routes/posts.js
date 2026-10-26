const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const db = require("../conf/database");
const PostError = require("../helpers/error/PostError");
const { successPrint, errorPrint } = require("../helpers/debug/debugprinters");
const { isLoggedIn } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const thumbnail = require("../helpers/media/thumbnail");

/**
 * Persist the frame postvideo.js captured in the browser.
 *
 * Only used when server-side ffmpeg generation did not produce anything.
 *
 * @returns {Promise<string|null>} Public URL of the saved image, or null.
 */
async function saveClientThumbnail(thumbData, file, baseName) {
  if (typeof thumbData !== "string" || thumbData.length === 0) {
    return null;
  }

  const match = thumbData.match(
    /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/
  );
  if (!match) {
    return null;
  }

  const ext = match[1] === "png" ? ".png" : ".jpg";
  const thumbName = baseName + ext;

  try {
    await fs.promises.writeFile(
      path.join(path.dirname(file.path), thumbName),
      Buffer.from(match[2], "base64")
    );
    return `/public/videos/uploads/${thumbName}`;
  } catch (writeErr) {
    errorPrint(`Could not save client thumbnail: ${writeErr.message}`);
    return null;
  }
}

/**
 * FR7 - Create a new video post. Login required.
 *
 * The multer middleware runs first and puts the saved file on req.file.
 */
router.post(
  "/",
  isLoggedIn,
  function (req, res, next) {
    upload.single("video")(req, res, function (err) {
      if (err) {
        errorPrint(`Upload rejected: ${err.message}`);
        return next(new PostError(err.message, "/postvideo", 400));
      }
      next();
    });
  },
  async function (req, res, next) {
    const title = (req.body.title || "").trim();
    const description = (req.body.description || "").trim();

    try {
      if (!req.file) {
        throw new PostError("Please choose a video file to upload.", "/postvideo", 400);
      }
      if (title.length < 3 || title.length > 255) {
        throw new PostError("Title must be between 3 and 255 characters.", "/postvideo", 400);
      }
      if (!req.body.acceptPolicy) {
        throw new PostError("You must accept the Acceptable Use Policy.", "/postvideo", 400);
      }

      // Path the browser will request, not a filesystem path.
      const videoUrl = `/public/videos/uploads/${req.file.filename}`;
      const baseName = path.parse(req.file.filename).name;

      /*
       * Thumbnails are produced two ways, tried in order:
       *
       *  1. ffmpeg on the server, which is what the project specification calls
       *     for. Authoritative when it works.
       *  2. The frame postvideo.js captured in the browser and posted as a data
       *     URL. This covers the case where ffmpeg is unavailable or chokes on
       *     the file.
       *
       * If both fail the card falls back to rendering the video element itself,
       * so a post is never left without something to show.
       */
      let thumbnailUrl = await thumbnail.generate(req.file.path, baseName);

      if (!thumbnailUrl) {
        thumbnailUrl = await saveClientThumbnail(
          req.body.thumbnailData,
          req.file,
          baseName
        );
      }

      if (!thumbnailUrl) {
        thumbnailUrl = videoUrl;
      }

      const [result] = await db.execute(
        `INSERT INTO posts (title, description, video, thumbnail, fk_userId)
         VALUES (?, ?, ?, ?, ?)`,
        [title, description, videoUrl, thumbnailUrl, req.session.user.id]
      );

      successPrint(`Post ${result.insertId} created by ${req.session.user.username}.`);
      req.session.flash = { type: "success", message: "Your video was posted!" };
      return req.session.save(() => res.redirect(`/posts/${result.insertId}`));
    } catch (err) {
      // If the DB insert failed, do not leave an orphaned file on disk.
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      if (!(err instanceof PostError)) errorPrint("Creating post failed");
      return next(err);
    }
  }
);

/**
 * FR13 - View a single post, with its comments and like state.
 */
router.get("/:id", async function (req, res, next) {
  const postId = Number(req.params.id);

  try {
    if (!Number.isInteger(postId) || postId < 1) {
      throw new PostError("That post does not exist.", "/", 404);
    }

    const [posts] = await db.execute(
      `SELECT p.id, p.title, p.description, p.video, p.thumbnail, p.createdAt,
              u.id AS authorId, u.username AS author,
              (SELECT COUNT(*) FROM likes l WHERE l.fk_postId = p.id) AS likeCount
         FROM posts p
         JOIN users u ON u.id = p.fk_userId
        WHERE p.id = ?`,
      [postId]
    );

    if (posts.length === 0) {
      throw new PostError("That post does not exist.", "/", 404);
    }
    const post = posts[0];

    const [comments] = await db.execute(
      `SELECT c.id, c.text, c.createdAt, u.id AS authorId, u.username AS author
         FROM comments c
         JOIN users u ON u.id = c.fk_userId
        WHERE c.fk_postId = ?
        ORDER BY c.createdAt ASC`,
      [postId]
    );

    // Does the current user already like this post?
    let userHasLiked = false;
    if (req.session.user) {
      const [liked] = await db.execute(
        "SELECT id FROM likes WHERE fk_userId = ? AND fk_postId = ?",
        [req.session.user.id, postId]
      );
      userHasLiked = liked.length > 0;
    }

    const isOwner =
      Boolean(req.session.user) && req.session.user.id === post.authorId;

    res.render("viewpost", {
      title: `Videoz - ${post.title}`,
      bannerTitle: post.title,
      post,
      comments,
      commentCount: comments.length,
      userHasLiked,
      isOwner,
    });
  } catch (err) {
    if (!(err instanceof PostError)) errorPrint("Loading post failed");
    next(err);
  }
});

/**
 * FR8 - Comment on a post. Login required.
 */
router.post("/:id/comment", isLoggedIn, async function (req, res, next) {
  const postId = Number(req.params.id);
  const text = (req.body.text || "").trim();

  try {
    if (!Number.isInteger(postId) || postId < 1) {
      throw new PostError("That post does not exist.", "/", 404);
    }
    if (text.length === 0) {
      throw new PostError("Comment cannot be empty.", `/posts/${postId}`, 400);
    }
    if (text.length > 2000) {
      throw new PostError("Comment is too long (2000 characters max).", `/posts/${postId}`, 400);
    }

    const [posts] = await db.execute("SELECT id FROM posts WHERE id = ?", [postId]);
    if (posts.length === 0) {
      throw new PostError("That post does not exist.", "/", 404);
    }

    await db.execute(
      "INSERT INTO comments (text, fk_userId, fk_postId) VALUES (?, ?, ?)",
      [text, req.session.user.id, postId]
    );

    successPrint(`Comment added to post ${postId} by ${req.session.user.username}.`);
    res.redirect(`/posts/${postId}#comments`);
  } catch (err) {
    if (!(err instanceof PostError)) errorPrint("Adding comment failed");
    next(err);
  }
});

/**
 * FR9 - Like / unlike a post. Login required.
 *
 * The UNIQUE (fk_userId, fk_postId) constraint on the likes table means a user
 * can never like the same post twice, so this route just toggles.
 */
router.post("/:id/like", isLoggedIn, async function (req, res, next) {
  const postId = Number(req.params.id);

  try {
    if (!Number.isInteger(postId) || postId < 1) {
      throw new PostError("That post does not exist.", "/", 404);
    }

    const [posts] = await db.execute("SELECT id FROM posts WHERE id = ?", [postId]);
    if (posts.length === 0) {
      throw new PostError("That post does not exist.", "/", 404);
    }

    const [existing] = await db.execute(
      "SELECT id FROM likes WHERE fk_userId = ? AND fk_postId = ?",
      [req.session.user.id, postId]
    );

    if (existing.length > 0) {
      await db.execute("DELETE FROM likes WHERE id = ?", [existing[0].id]);
      successPrint(`Post ${postId} unliked by ${req.session.user.username}.`);
    } else {
      await db.execute(
        "INSERT INTO likes (fk_userId, fk_postId) VALUES (?, ?)",
        [req.session.user.id, postId]
      );
      successPrint(`Post ${postId} liked by ${req.session.user.username}.`);
    }

    res.redirect(`/posts/${postId}`);
  } catch (err) {
    if (!(err instanceof PostError)) errorPrint("Liking post failed");
    next(err);
  }
});

/**
 * FR6 - Delete a post. Only the user who created it may do so.
 * Comments and likes are removed by the ON DELETE CASCADE foreign keys.
 */
router.post("/:id/delete", isLoggedIn, async function (req, res, next) {
  const postId = Number(req.params.id);

  try {
    if (!Number.isInteger(postId) || postId < 1) {
      throw new PostError("That post does not exist.", "/", 404);
    }

    const [posts] = await db.execute(
      "SELECT id, video, thumbnail, fk_userId FROM posts WHERE id = ?",
      [postId]
    );
    if (posts.length === 0) {
      throw new PostError("That post does not exist.", "/", 404);
    }

    const post = posts[0];
    if (post.fk_userId !== req.session.user.id) {
      throw new PostError(
        "You can only delete your own posts.",
        `/posts/${postId}`,
        403
      );
    }

    await db.execute("DELETE FROM posts WHERE id = ?", [postId]);

    // Remove the uploaded video and its thumbnail from disk as well. The
    // thumbnail lives in public/images when ffmpeg produced it, or alongside
    // the video in public/videos/uploads when the browser capture was used.
    const ASSET_PREFIXES = ["/public/videos/uploads/", "/public/images/"];

    [post.video, post.thumbnail].forEach((assetUrl) => {
      if (!assetUrl) return;
      if (!ASSET_PREFIXES.some((prefix) => assetUrl.startsWith(prefix))) return;

      const diskPath = path.join(
        __dirname,
        "..",
        assetUrl.replace("/public/", "public/")
      );
      fs.unlink(diskPath, () => {});
    });

    successPrint(`Post ${postId} deleted by ${req.session.user.username}.`);
    req.session.flash = { type: "success", message: "Post deleted." };
    return req.session.save(() => res.redirect("/"));
  } catch (err) {
    if (!(err instanceof PostError)) errorPrint("Deleting post failed");
    next(err);
  }
});

module.exports = router;
