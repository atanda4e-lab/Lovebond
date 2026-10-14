// ========================================
// LOVEBOND - FIREBASE REGISTRATION
// ========================================

import {
    createUserWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { auth, db } from "./firebase.js";

console.log("LoveBond registration JavaScript is loaded! ❤️");

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        const agreeTerms = document.getElementById("agreeTerms").checked;
        const message = document.getElementById("registerMessage");
        const button = document.getElementById("registerButton");

        function showMessage(text, type) {
            message.textContent = text;
            message.className = "register-message " + type;
        }

        if (password !== confirmPassword) {
            showMessage("Your passwords do not match.", "error");
            return;
        }

        if (!agreeTerms) {
            showMessage("Please accept the agreement first.", "error");
            return;
        }

        button.disabled = true;
        button.textContent = "Creating Account...";

        showMessage("Creating your account...", "info");

        try {
            const result = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = result.user;

            await updateProfile(user, {
                displayName: fullName
            });

            await setDoc(doc(db, "users", user.uid), {
                fullName: fullName,
                email: user.email,
                createdAt: serverTimestamp()
            });

            showMessage(
                "Account created successfully! Welcome to LoveBond ❤️",
                "success"
            );

            button.textContent = "Account Created!";

            setTimeout(function () {
                window.location.href = "discover.html";
            }, 1800);

        } catch (error) {
            console.error("Registration error:", error);

            if (error.code === "auth/email-already-in-use") {
                showMessage(
                    "This email is already registered. Please log in.",
                    "error"
                );
            } else if (error.code === "auth/invalid-email") {
                showMessage("Please enter a valid email.", "error");
            } else if (error.code === "auth/weak-password") {
                showMessage(
                    "Your password must contain at least 6 characters.",
                    "error"
                );
            } else {
                showMessage(
                    "Registration failed: " + error.message,
                    "error"
                );
            }

            button.disabled = false;
            button.textContent = "Create Account ❤️";
        }
    });
}