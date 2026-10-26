-- =============================================================================
--  Videoz -- database schema
--
--  Creates the database and all four tables. Safe to re-run: every statement
--  uses IF NOT EXISTS, so nothing is dropped and existing data is untouched.
--
--  Run it either way:
--
--    mysql -u root -p < database/init.sql
--
--  or, from the application folder, using the Node loader that runs the same
--  schema through the credentials in conf/config.js:
--
--    npm run builddb
-- =============================================================================

CREATE DATABASE IF NOT EXISTS videoz_db;
USE videoz_db;

-- -----------------------------------------------------------------------------
-- users  (NFR1, NFR2)
-- `password` holds a bcrypt hash, never a plain-text password. 255 chars leaves
-- room for any bcrypt variant; the current hashes are 60.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50)   NOT NULL UNIQUE,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  createdAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- posts  (NFR3)
-- `video` and `thumbnail` store web paths to files on disk, not the media itself.
-- Deleting a user removes their posts.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(255)  NOT NULL,
  description TEXT,
  video       VARCHAR(500)  NOT NULL,
  thumbnail   VARCHAR(500),
  createdAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fk_userId   INT           NOT NULL,
  CONSTRAINT fk_posts_user
    FOREIGN KEY (fk_userId) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- comments  (FR8)
-- Removing either the author or the post removes the comment.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  text        TEXT          NOT NULL,
  createdAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fk_userId   INT           NOT NULL,
  fk_postId   INT           NOT NULL,
  CONSTRAINT fk_comments_user
    FOREIGN KEY (fk_userId) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_comments_post
    FOREIGN KEY (fk_postId) REFERENCES posts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- likes  (FR9)
-- The UNIQUE pair is what enforces "one like per user per post" -- the database
-- rejects a duplicate even if the application logic is ever wrong.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  createdAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fk_userId   INT           NOT NULL,
  fk_postId   INT           NOT NULL,
  CONSTRAINT uq_like_once UNIQUE (fk_userId, fk_postId),
  CONSTRAINT fk_likes_user
    FOREIGN KEY (fk_userId) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_likes_post
    FOREIGN KEY (fk_postId) REFERENCES posts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
