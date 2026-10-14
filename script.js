// ========================================
// LOVEBOND - MAIN JAVASCRIPT
// ========================================

import { auth } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

console.log("LoveBond JavaScript loaded successfully ❤️");

// ========================================
// LOVE MESSAGE
// ========================================

function showLoveMessage() {
    alert("Someone believes in love, and that someone is you! ❤️");
}

window.showLoveMessage = showLoveMessage;


// ========================================
// WELCOME MESSAGE
// ========================================

function welcomeUser() {
    alert("Welcome to LoveBond! Two hearts, one beautiful journey. ❤️");
}

window.welcomeUser = welcomeUser;


// ========================================
// AUTHENTICATION STATE
// ========================================

onAuthStateChanged(auth, function (user) {
    console.log(
        "Authentication status:",
        user ? "Logged in" : "Logged out"
    );

    const loginLinks = document.querySelectorAll(".login-link");
    const joinLinks = document.querySelectorAll(".join-link");
    const logoutButtons = document.querySelectorAll(".logout-button");
    const profileLinks = document.querySelectorAll(".profile-link");

    const userNameElements = document.querySelectorAll(".user-name");
    const userEmailElements = document.querySelectorAll(".user-email");

    const welcomePanel = document.getElementById("welcomePanel");

    if (user) {
        console.log("Logged-in user:", user.displayName, user.email);

        // Hide login and registration links.
        loginLinks.forEach(function (element) {
            element.style.display = "none";
        });

        joinLinks.forEach(function (element) {
            element.style.display = "none";
        });

        // Show logout buttons.
        logoutButtons.forEach(function (element) {
            element.style.display = "inline-flex";
        });

        // Show profile links.
        profileLinks.forEach(function (element) {
            element.style.display = "";
        });

        // Display user information where applicable.
        userNameElements.forEach(function (element) {
            element.textContent = user.displayName || "LoveBond Member";
        });

        userEmailElements.forEach(function (element) {
            element.textContent = user.email || "";
        });

        // Show the Discover welcome panel if it exists.
        if (welcomePanel) {
            welcomePanel.style.display = "flex";
        }

    } else {
        // Show login and registration links.
        loginLinks.forEach(function (element) {
            element.style.display = "";
        });

        joinLinks.forEach(function (element) {
            element.style.display = "";
        });

        // Hide logout buttons.
        logoutButtons.forEach(function (element) {
            element.style.display = "none";
        });

        // Hide profile links for signed-out visitors.
        profileLinks.forEach(function (element) {
            element.style.display = "none";
        });

        // Clear user information.
        userNameElements.forEach(function (element) {
            element.textContent = "";
        });

        userEmailElements.forEach(function (element) {
            element.textContent = "";
        });

        // Hide the Discover welcome panel.
        if (welcomePanel) {
            welcomePanel.style.display = "none";
        }
    }
});


// ========================================
// LOGOUT
// ========================================

window.logoutUser = async function () {
    try {
        await signOut(auth);

        alert("You have logged out successfully. ❤️");

        window.location.href = "index.html";

    } catch (error) {
        console.error("Logout error:", error);

        alert("Unable to log out. Please try again.");
    }
};

console.log("LoveBond is ready! ❤️");