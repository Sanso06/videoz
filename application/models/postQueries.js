/**
 * Read queries for post "cards" -- the summary shape used by the home feed,
 * the search results page, and profile pages.
 *
 * All three needed the same SELECT, so it previously lived in triplicate and
 * would drift out of sync easily. Keeping it here means a change to what a card
 * shows is made once.
 */
const db = require("../conf/database");

/** Most posts any single page will render. */
const PAGE_SIZE = 50;

/*
 * Counts come from correlated subqueries rather than one JOIN with GROUP BY:
 * joining likes and comments together would multiply rows against each other
 * and inflate both totals. Each subquery uses the foreign-key index on
 * fk_postId, so this stays cheap at the page sizes involved here.
 */
const POST_CARD_SELECT = `
  SELECT p.id, p.title, p.description, p.video, p.thumbnail, p.createdAt,
         u.id AS authorId, u.username AS author,
         (SELECT COUNT(*) FROM likes    l WHERE l.fk_postId = p.id) AS likeCount,
         (SELECT COUNT(*) FROM comments c WHERE c.fk_postId = p.id) AS commentCount
    FROM posts p
    JOIN users u ON u.id = p.fk_userId
`;

/**
 * Newest posts across the whole site (FR12).
 */
async function findRecent() {
  const [rows] = await db.execute(
    `${POST_CARD_SELECT} ORDER BY p.createdAt DESC LIMIT ${PAGE_SIZE}`
  );
  return rows;
}

/**
 * Posts matching a search term in the title, description, or author name
 * (FR10, FR11).
 */
async function search(term) {
  const like = `%${term}%`;
  const [rows] = await db.execute(
    `${POST_CARD_SELECT}
      WHERE p.title LIKE ? OR p.description LIKE ? OR u.username LIKE ?
      ORDER BY p.createdAt DESC
      LIMIT ${PAGE_SIZE}`,
    [like, like, like]
  );
  return rows;
}

/**
 * Every post by one user, newest first (FR5).
 */
async function findByAuthor(userId) {
  const [rows] = await db.execute(
    `${POST_CARD_SELECT} WHERE p.fk_userId = ? ORDER BY p.createdAt DESC`,
    [userId]
  );
  return rows;
}

module.exports = { findRecent, search, findByAuthor, PAGE_SIZE };
