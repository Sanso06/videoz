/**
 * Multer configuration for video uploads.
 *
 * Files land in public/videos/uploads so that Express's static middleware can
 * serve them straight back at /public/videos/uploads/<filename>.
 */
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const config = require("../conf/config");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "videos", "uploads");

// Make sure the folder exists before multer tries to write into it.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Random name keeps uploads from colliding and strips any path tricks
    // hidden in the original filename.
    const unique = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
];

function fileFilter(req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error("Only MP4, WebM, OGG, or MOV video files are allowed."));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxUploadBytes,
    // The generated thumbnail arrives as a base64 data URL in a text field,
    // which is far larger than multer's 1 MB default for fields.
    fieldSize: 8 * 1024 * 1024,
  },
});

module.exports = { upload, UPLOAD_DIR };
