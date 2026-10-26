const AppError = require("./AppError");

/**
 * Raised for problems with accounts, authentication, or sessions -- a taken
 * username, bad credentials, a page that requires logging in.
 */
class UserError extends AppError {}

module.exports = UserError;
