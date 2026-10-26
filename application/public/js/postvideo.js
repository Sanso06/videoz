/**
 * Captures a thumbnail from the chosen video before the upload form is sent.
 *
 * Why this exists: an MP4 stores its index (the "moov" atom) either at the front
 * or the back of the file. When it sits at the back -- common for camera and
 * encoder output -- a browser streaming the file over HTTP cannot decode a
 * single frame until the whole file has arrived, so a <video> used as a
 * thumbnail renders as a black rectangle.
 *
 * Reading the file locally has no such limitation: it is already on disk, so the
 * browser can seek and paint immediately. We draw that frame to a canvas, export
 * it as a JPEG data URL, and submit it alongside the video. The server writes it
 * out as a normal .jpg and the feed renders a plain <img>.
 *
 * Every failure path degrades quietly: the upload still succeeds without a
 * thumbnail, and the server falls back to the video itself.
 */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector('form[action="/posts"]');
    if (!form) {
        return;
    }

    const fileInput = form.querySelector('input[name="video"]');
    const hiddenField = form.querySelector('input[name="thumbnailData"]');
    const preview = document.getElementById("thumbPreview");
    const status = document.getElementById("thumbStatus");

    if (!fileInput || !hiddenField) {
        return;
    }

    /** Widest the stored thumbnail will be, in pixels. */
    const MAX_WIDTH = 480;
    /** How far into the clip to sample, to avoid a black opening frame. */
    const SAMPLE_SECONDS = 0.5;
    /** Give up rather than leave the user staring at a stuck message. */
    const TIMEOUT_MS = 15000;

    fileInput.addEventListener("change", () => {
        hiddenField.value = "";
        if (preview) {
            preview.hidden = true;
        }

        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            if (status) status.textContent = "";
            return;
        }

        if (status) status.textContent = "Generating thumbnail...";

        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;

        let settled = false;

        function finish(message) {
            if (settled) return;
            settled = true;
            if (status) status.textContent = message;
            URL.revokeObjectURL(objectUrl);
        }

        video.addEventListener("loadeddata", () => {
            const duration = isFinite(video.duration) ? video.duration : 1;
            video.currentTime = Math.min(SAMPLE_SECONDS, duration / 2);
        }, { once: true });

        video.addEventListener("seeked", () => {
            if (settled) return;

            const { videoWidth: width, videoHeight: height } = video;
            if (!width || !height) {
                return finish("");
            }

            try {
                const scale = Math.min(1, MAX_WIDTH / width);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(width * scale);
                canvas.height = Math.round(height * scale);
                canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

                const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                hiddenField.value = dataUrl;

                if (preview) {
                    preview.src = dataUrl;
                    preview.hidden = false;
                }
                finish("Thumbnail ready.");
            } catch (err) {
                // Typically a cross-origin taint, which cannot happen for a
                // locally chosen file, but the upload should survive it anyway.
                finish("");
            }
        }, { once: true });

        video.addEventListener("error", () => finish(""), { once: true });
        setTimeout(() => finish(""), TIMEOUT_MS);

        video.src = objectUrl;
    });
});
