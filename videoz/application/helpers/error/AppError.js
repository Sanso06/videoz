/**
 * Base class for errors that the application raises deliberately, as opposed to
 * unexpected crashes.
 *
 * These carry a redirect target so the error handler in app.js can send the
 * visitor back to a sensible page with a flash message, instead of dumping them
 * on a generic error screen. Anything that is NOT an AppError is treated as a
 * genuine fault and rendered on the error page.
 */
class AppError extends Error {
  /**
   * @param {string} message   Shown directly to the user, so keep it readable.
   * @param {string} redirectURL  Where to send the user after the failure.
   * @param {number} [status=400] HTTP status to report.
   */
  constructor(message, redirectURL, status = 400) {
    super(message);
    this.name = new.target.name;
    this.redirectURL = redirectURL;
    this.status = status;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }

  getMessage() {
    return this.message;
  }

  getRedirectURL() {
    return this.redirectURL;
  }

  getStatus() {
    return this.status;
  }
}

module.exports = AppError;
