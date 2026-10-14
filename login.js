// ========================================
// LOVEBOND LOGIN SYSTEM
// ========================================

import { auth } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

// Get form elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const togglePassword = document.getElementById("togglePassword");
const forgotPassword = document.getElementById("forgotPassword");

// ========================================
// DISPLAY MESSAGES
// ========================================

function showMessage(message, type) {
    loginMessage.textContent = message;
    loginMessage.className = "login-message " + type;
}

// ========================================
// SHOW OR HIDE PASSWORD
// ========================================

togglePassword.addEventListener("click", function () {
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        togglePassword.textContent = "Hide";
    } else {
        passwordInput.type = "password";
        togglePassword.textContent = "Show";
    }
});

// ========================================
// LOG IN
// ========================================

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Please enter your email and password.", "error");
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    showMessage("Checking your account...", "info");

    try {
        const result = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        console.log("Login successful:", result.user.email);

        showMessage(
            "Login successful! Welcome back ❤️",
            "success"
        );

        loginButton.textContent = "Login Successful!";

        setTimeout(function () {
            window.location.href = "discover.html";
        }, 1000);

    } catch (error) {
        console.error("Login error:", error);

        let message = "Unable to log in. Please try again.";

        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/user-not-found"
        ) {
            message = "Incorrect email or password. Please check your details.";
        } else if (error.code === "auth/invalid-email") {
            message = "Please enter a valid email address.";
        } else if (error.code === "auth/too-many-requests") {
            message = "Too many attempts. Please wait a while and try again.";
        } else if (error.code === "auth/network-request-failed") {
            message = "Network error. Check your internet connection.";
        } else if (error.code === "auth/user-disabled") {
            message = "This account has been disabled.";
        }

        showMessage(message, "error");

        loginButton.disabled = false;
        loginButton.textContent = "Log In ❤️";
    }
});

// ========================================
// FORGOT PASSWORD
// ========================================

forgotPassword.addEventListener("click", async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();

    if (!email) {
        showMessage(
            "Enter your email address first, then select Forgot password.",
            "error"
        );

        emailInput.focus();
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);

        showMessage(
            "If an account exists for that email, a password reset email will be sent. Check your inbox and spam folder.",
            "success"
        );

    } catch (error) {
        console.error("Password reset error:", error);

        if (error.code === "auth/invalid-email") {
            showMessage("Please enter a valid email address.", "error");
        } else {
            showMessage(
                "Unable to request a reset email right now. Please try again later.",
                "error"
            );
        }
    }
});

console.log("LoveBond login system is ready ❤️");