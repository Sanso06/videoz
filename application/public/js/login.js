/**
 * Client-side validation for the login form (NFR5).
 *
 * These checks mirror the ones in routes/users.js. The server copy is the one
 * that actually protects the application -- anything enforced only in the
 * browser can be bypassed -- while this copy exists to give the user immediate
 * feedback instead of a page reload.
 *
 * Deliberately permissive: it only catches empty or obviously malformed input.
 * Judging a password's correctness is the server's job, and being stricter here
 * would lock out anyone whose account predates a rule change.
 */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    if (!form) {
        return;
    }

    const identifier = document.getElementById("loginUsername");
    const password = document.getElementById("loginPassword");
    const identifierError = document.getElementById("loginUsernameError");
    const passwordError = document.getElementById("loginPasswordError");

    function setInvalid(input, errorSpan, message) {
        input.classList.add("invalid");
        input.setAttribute("aria-invalid", "true");
        errorSpan.textContent = message;
    }

    function setValid(input, errorSpan) {
        input.classList.remove("invalid");
        input.removeAttribute("aria-invalid");
        errorSpan.textContent = "";
    }

    function checkIdentifier() {
        const value = identifier.value.trim();

        if (value === "") {
            setInvalid(identifier, identifierError,
                "Enter your username or email.");
            return false;
        }

        // Anything containing "@" is being offered as an email, so hold it to
        // the shape of one. Otherwise apply the username rules.
        if (value.includes("@")) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                setInvalid(identifier, identifierError,
                    "That does not look like a valid email address.");
                return false;
            }
        } else if (!/^[a-zA-Z][a-zA-Z0-9]{2,}$/.test(value)) {
            setInvalid(identifier, identifierError,
                "Usernames start with a letter and are at least 3 letters or numbers.");
            return false;
        }

        setValid(identifier, identifierError);
        return true;
    }

    function checkPassword() {
        if (password.value === "") {
            setInvalid(password, passwordError, "Enter your password.");
            return false;
        }
        setValid(password, passwordError);
        return true;
    }

    identifier.addEventListener("input", checkIdentifier);
    password.addEventListener("input", checkPassword);

    form.addEventListener("submit", (event) => {
        const okIdentifier = checkIdentifier();
        const okPassword = checkPassword();

        if (okIdentifier && okPassword) {
            return; // let the browser post to /users/login
        }

        event.preventDefault();
    });
});
