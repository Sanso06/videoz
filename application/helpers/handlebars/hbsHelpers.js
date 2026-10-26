/**
 * Custom Handlebars helpers registered in app.js.
 */
const helpers = {
  /** Equality test usable inside {{#if}} blocks. */
  eq: (a, b) => a === b,

  /** Friendly date, e.g. "August 4, 2026". */
  formatDate: (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  },

  /** Correct singular/plural label, e.g. "1 like" / "3 likes". */
  pluralize: (count, singular, plural) =>
    Number(count) === 1 ? `${count} ${singular}` : `${count} ${plural}`,

  /**
   * True when a stored thumbnail path is a real image file rather than a
   * fallback pointing at the video itself.
   */
  isImage: (value) =>
    typeof value === "string" && /\.(jpe?g|png|webp)$/i.test(value),

  /** Shorten long text for cards. */
  truncate: (text, length) => {
    if (!text) return "";
    const limit = Number(length) || 100;
    return text.length > limit ? `${text.substring(0, limit)}...` : text;
  },
};

module.exports = helpers;
