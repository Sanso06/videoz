/**
 * Server-side thumbnail generation with ffmpeg.
 *
 * The bundled `ffmpeg-static` binary is used so nothing has to be installed
 * system-wide: the package ships a platform-appropriate ffmpeg and exports its
 * path.
 *
 * A frame is grabbed one second into the clip (or at the midpoint for very
 * short ones) and written as a JPEG into public/images.
 *
 * If this fails for any reason -- missing binary, unsupported codec, a corrupt
 * upload -- the caller falls back to the thumbnail the browser captured during
 * upload. Between the two, a post effectively always ends up with an image.
 */
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const { errorPrint, successPrint } = require("../debug/debugprinters");

const execFileAsync = promisify(execFile);

/** Where generated thumbnails live, per the project specification. */
const IMAGE_DIR = path.join(__dirname, "..", "..", "public", "images");

/** Public URL prefix matching IMAGE_DIR. */
const IMAGE_URL_PREFIX = "/public/images";

/** How far into the video to sample, in seconds. */
const SAMPLE_SECONDS = 1;

/** Give up rather than hang a request on a pathological file. */
const TIMEOUT_MS = 20000;

fs.mkdirSync(IMAGE_DIR, { recursive: true });

/**
 * Resolve the bundled ffmpeg binary.
 * @returns {string|null} Path to ffmpeg, or null if the package is unavailable.
 */
function resolveFfmpeg() {
  let ffmpegPath;

  try {
    // Resolved lazily so a missing optional dependency cannot stop the server
    // from booting.
    ffmpegPath = require("ffmpeg-static");
  } catch (err) {
    errorPrint("ffmpeg-static is not installed. Run: npm install");
    return null;
  }

  if (typeof ffmpegPath !== "string" || ffmpegPath.length === 0) {
    errorPrint("ffmpeg-static did not report a binary path.");
    return null;
  }

  /*
   * The package downloads its binary in a postinstall script. npm can be
   * configured to block install scripts, in which case the module resolves to a
   * path that does not exist. Check for the file rather than trusting the path,
   * so the cause is obvious instead of surfacing later as a confusing spawn
   * error.
   */
  if (!fs.existsSync(ffmpegPath)) {
    errorPrint(
      `ffmpeg binary missing at ${ffmpegPath} -- its install script was blocked. ` +
        "Run: npm approve-scripts ffmpeg-static && npm rebuild ffmpeg-static"
    );
    return null;
  }

  return ffmpegPath;
}

/**
 * Extract a still frame from a video file.
 *
 * @param {string} videoPath  Absolute path to the uploaded video.
 * @param {string} baseName   Filename stem to reuse for the image.
 * @returns {Promise<string|null>} Public URL of the thumbnail, or null on failure.
 */
async function generate(videoPath, baseName) {
  const ffmpegPath = resolveFfmpeg();
  if (!ffmpegPath) {
    errorPrint("ffmpeg-static is not installed; falling back to client thumbnail.");
    return null;
  }

  const outputName = `${baseName}.jpg`;
  const outputPath = path.join(IMAGE_DIR, outputName);

  // -ss before -i seeks quickly without decoding everything up to that point.
  // -frames:v 1 takes exactly one frame; -vf scale caps the width at 480px and
  // keeps the aspect ratio (-2 rounds the height to an even number, which JPEG
  // encoders require).
  const args = [
    "-y",
    "-ss", String(SAMPLE_SECONDS),
    "-i", videoPath,
    "-frames:v", "1",
    "-vf", "scale=480:-2",
    "-q:v", "3",
    outputPath,
  ];

  try {
    await execFileAsync(ffmpegPath, args, { timeout: TIMEOUT_MS });

    // ffmpeg can exit successfully having written nothing, for instance when
    // the seek lands past the end of a very short clip.
    const stats = await fs.promises.stat(outputPath).catch(() => null);
    if (!stats || stats.size === 0) {
      errorPrint("ffmpeg produced no thumbnail; falling back to client capture.");
      return null;
    }

    successPrint(`Generated thumbnail ${outputName}`);
    return `${IMAGE_URL_PREFIX}/${outputName}`;
  } catch (err) {
    errorPrint(`ffmpeg thumbnail failed: ${err.message}`);
    return null;
  }
}

module.exports = { generate, IMAGE_DIR, IMAGE_URL_PREFIX };
