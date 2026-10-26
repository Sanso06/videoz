const AppError = require("./AppError");

/**
 * Raised for problems with posts, comments, likes, or uploads -- a missing
 * post, a rejected file, an attempt to delete someone else's post.
 */
class PostError extends AppError {}

module.exports = PostError;
