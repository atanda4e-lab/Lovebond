// ============================================
// LOVEBOND - PROFILE MANAGEMENT
// ============================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// ============================================
// HTML ELEMENTS
// ============================================

const profileForm = document.getElementById("profileForm");

const fullNameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const ageInput = document.getElementById("age");
const locationInput = document.getElementById("location");
const photoURLInput = document.getElementById("photoURL");
const bioInput = document.getElementById("bio");
const interestsInput = document.getElementById("interests");

const profilePicture = document.getElementById("profilePicture");
const previewName = document.getElementById("previewName");
const previewLocation = document.getElementById("previewLocation");

const profileMessage = document.getElementById("profileMessage");
const saveProfileButton = document.getElementById("saveProfileButton");
const logoutButton = document.getElementById("logoutButton");

const DEFAULT_PICTURE =
    "https://placehold.co/125x125/ffe0e9/e63968?text=Love";

let currentUser = null;
let isSaving = false;

// ============================================
// DISPLAY MESSAGES
// ============================================

function showMessage(message, type = "info") {
    profileMessage.textContent = message;
    profileMessage.className = type;
}

// ============================================
// UPDATE PROFILE PREVIEW
// ============================================

function updateProfilePreview() {
    const name = fullNameInput.value.trim();
    const location = locationInput.value.trim();
    const photoURL = photoURLInput.value.trim();

    previewName.textContent = name || "Your Name";

    previewLocation.textContent =
        location || "Add your location";

    profilePicture.src = photoURL || DEFAULT_PICTURE;
}

profilePicture.addEventListener("error", function () {
    profilePicture.onerror = null;
    profilePicture.src = DEFAULT_PICTURE;
});

fullNameInput.addEventListener("input", updateProfilePreview);
locationInput.addEventListener("input", updateProfilePreview);
photoURLInput.addEventListener("input", updateProfilePreview);

// ============================================
// LOAD PROFILE
// ============================================

async function loadProfile(user) {
    emailInput.value = user.email || "";

    try {
        const privateProfileRef = doc(db, "users", user.uid);
        const publicProfileRef = doc(db, "publicProfiles", user.uid);

        const [privateSnapshot, publicSnapshot] = await Promise.all([
            getDoc(privateProfileRef),
            getDoc(publicProfileRef)
        ]);

        const privateData = privateSnapshot.exists()
            ? privateSnapshot.data()
            : {};

        const publicData = publicSnapshot.exists()
            ? publicSnapshot.data()
            : {};

        fullNameInput.value =
            privateData.fullName ||
            publicData.fullName ||
            user.displayName ||
            "";

        ageInput.value =
            privateData.age ??
            publicData.age ??
            "";

        locationInput.value =
            privateData.location ??
            publicData.location ??
            "";

        photoURLInput.value =
            privateData.photoURL ??
            publicData.photoURL ??
            "";

        bioInput.value =
            privateData.bio ??
            publicData.bio ??
            "";

        interestsInput.value =
            privateData.interests ??
            publicData.interests ??
            "";

        updateProfilePreview();

        console.log("LoveBond profile loaded successfully.");

    } catch (error) {
        console.error("Profile loading error:", error);

        showMessage(
            "Your profile could not be loaded. Check your Firestore security rules and internet connection.",
            "error"
        );
    }
}

// ============================================
// CHECK LOGIN STATUS
// ============================================

onAuthStateChanged(auth, async function (user) {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;

    await loadProfile(user);
});

// ============================================
// VALIDATE PROFILE INFORMATION
// ============================================

function validateProfile() {
    const fullName = fullNameInput.value.trim();
    const age = Number(ageInput.value);
    const photoURL = photoURLInput.value.trim();

    if (!fullName) {
        showMessage("Please enter your full name.", "error");
        fullNameInput.focus();
        return false;
    }

    if (fullName.length > 80) {
        showMessage(
            "Your name cannot exceed 80 characters.",
            "error"
        );
        fullNameInput.focus();
        return false;
    }

    if (!Number.isInteger(age) || age < 18 || age > 120) {
        showMessage(
            "LoveBond is for adults aged 18 and above. Please enter a valid age.",
            "error"
        );
        ageInput.focus();
        return false;
    }

    if (photoURL) {
        try {
            const parsedURL = new URL(photoURL);

            if (parsedURL.protocol !== "https:") {
                throw new Error("HTTPS required");
            }
        } catch {
            showMessage(
                "Enter a valid HTTPS URL for your profile picture.",
                "error"
            );
            photoURLInput.focus();
            return false;
        }
    }

    if (locationInput.value.trim().length > 100) {
        showMessage(
            "Your location cannot exceed 100 characters.",
            "error"
        );
        locationInput.focus();
        return false;
    }

    if (bioInput.value.trim().length > 500) {
        showMessage(
            "Your bio cannot exceed 500 characters.",
            "error"
        );
        bioInput.focus();
        return false;
    }

    if (interestsInput.value.trim().length > 250) {
        showMessage(
            "Your interests cannot exceed 250 characters.",
            "error"
        );
        interestsInput.focus();
        return false;
    }

    return true;
}

// ============================================
// SAVE PROFILE
// ============================================

profileForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (isSaving) {
        return;
    }

    if (!currentUser) {
        showMessage(
            "Please log in before saving your profile.",
            "error"
        );
        return;
    }

    if (!validateProfile()) {
        return;
    }

    const profileData = {
        fullName: fullNameInput.value.trim(),
        age: Number(ageInput.value),
        location: locationInput.value.trim(),
        photoURL: photoURLInput.value.trim(),
        bio: bioInput.value.trim(),
        interests: interestsInput.value.trim()
    };

    isSaving = true;
    saveProfileButton.disabled = true;
    saveProfileButton.textContent = "Saving Profile...";

    showMessage("Saving your profile...", "info");

    try {
        // Update Firebase Authentication display name.
        await updateProfile(currentUser, {
            displayName: profileData.fullName
        });

        // Save private account information.
        const privateProfileRef = doc(
            db,
            "users",
            currentUser.uid
        );

        await setDoc(
            privateProfileRef,
            {
                fullName: profileData.fullName,
                email: currentUser.email,
                age: profileData.age,
                location: profileData.location,
                photoURL: profileData.photoURL,
                bio: profileData.bio,
                interests: profileData.interests,
                updatedAt: serverTimestamp()
            },
            {
                merge: true
            }
        );

        // Publish information members choose to share.
        const publicProfileRef = doc(
            db,
            "publicProfiles",
            currentUser.uid
        );

        await setDoc(
            publicProfileRef,
            {
                fullName: profileData.fullName,
                age: profileData.age,
                location: profileData.location,
                photoURL: profileData.photoURL,
                bio: profileData.bio,
                interests: profileData.interests,
                updatedAt: serverTimestamp()
            },
            {
                merge: true
            }
        );

        updateProfilePreview();

        showMessage(
            "Your profile has been saved successfully! ❤️",
            "success"
        );

        console.log("LoveBond profile saved.");

    } catch (error) {
        console.error("Profile saving error:", error);

        if (error.code === "permission-denied") {
            showMessage(
                "Firebase denied access. Check the Firestore rules for both users and publicProfiles.",
                "error"
            );
        } else if (error.code === "unavailable") {
            showMessage(
                "Firebase is temporarily unavailable. Check your internet connection and try again.",
                "error"
            );
        } else {
            showMessage(
                "Unable to save your profile. Please try again.",
                "error"
            );
        }

    } finally {
        isSaving = false;
        saveProfileButton.disabled = false;
        saveProfileButton.textContent = "Save My Profile ❤️";
    }
});

// ============================================
// LOG OUT
// ============================================

if (logoutButton) {
    logoutButton.addEventListener("click", async function (event) {
        event.preventDefault();

        try {
            await signOut(auth);
            window.location.replace("index.html");

        } catch (error) {
            console.error("Logout error:", error);

            showMessage(
                "Unable to log out. Please try again.",
                "error"
            );
        }
    });
}

console.log("LoveBond profile system ready ❤️");