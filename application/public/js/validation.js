/**
 * Live validation for the registration form.
 *
 * These rules are duplicated on the server in routes/users.js. That repetition
 * is deliberate: this copy exists to give immediate feedback, and the server
 * copy exists because anything enforced only in the browser can be bypassed.
 */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    if (!form) {
        return;
    }

    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");

    const usernameError = document.getElementById("usernameError");
    const passwordError = document.getElementById("passwordError");
    const confirmError = document.getElementById("confirmError");
    const successMessage = document.getElementById("successMessage");

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

    function checkUsername() {
        const pattern = /^[a-zA-Z][a-zA-Z0-9]{2,}$/;
        if (pattern.test(username.value)) {
            setValid(username, usernameError);
            return true;
        }
        setInvalid(username, usernameError,
            "Username must start with a letter and be at least 3 letters or numbers.");
        return false;
    }

    function checkPassword() {
        const value = password.value;
        const longEnough = value.length >= 8;
        const hasUpper = /[A-Z]/.test(value);
        const hasNumber = /[0-9]/.test(value);
        const hasSpecial = /[/*\-+!@#$^&~\[\]]/.test(value);

        if (longEnough && hasUpper && hasNumber && hasSpecial) {
            setValid(password, passwordError);
            return true;
        }
        setInvalid(password, passwordError,
            "Password needs 8+ characters, an uppercase letter, a number, and a special character (/*-+!@#$^&~[]).");
        return false;
    }

    function checkConfirm() {
        if (confirmPassword.value !== "" && confirmPassword.value === password.value) {
            setValid(confirmPassword, confirmError);
            return true;
        }
        setInvalid(confirmPassword, confirmError, "Passwords do not match.");
        return false;
    }

    username.addEventListener("input", checkUsername);
    confirmPassword.addEventListener("input", checkConfirm);
    password.addEventListener("input", () => {
        checkPassword();
        if (confirmPassword.value !== "") {
            checkConfirm();
        }
    });

    // The form posts to /users/register, so only block submission when a check
    // actually fails.
    form.addEventListener("submit", (event) => {
        const okUsername = checkUsername();
        const okPassword = checkPassword();
        const okConfirm = checkConfirm();

        if (okUsername && okPassword && okConfirm) {
            successMessage.textContent = "Creating your account...";
            return;
        }

        event.preventDefault();
        successMessage.textContent = "";
    });
});
