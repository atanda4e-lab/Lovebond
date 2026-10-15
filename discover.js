// ========================================
// LOVEBOND - DISCOVER SYSTEM
// ========================================

import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


// ========================================
// HTML ELEMENTS
// ========================================

const profilesGrid = document.getElementById("profilesGrid");
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");
const welcomePanel = document.getElementById("welcomePanel");
const welcomeName = document.querySelector(".user-name");

const profileCompletionNotice = document.getElementById(
    "profileCompletionNotice"
);


// ========================================
// APPLICATION STATE
// ========================================

let currentUser = null;
let allProfiles = [];
let likedUsers = new Set();

let profilesLoading = false;
let likeInProgress = new Set();


// ========================================
// DISPLAY STATUS
// ========================================

function showMessage(message) {
    if (!profilesGrid) {
        return;
    }

    profilesGrid.innerHTML = "";

    const messageElement = document.createElement("p");

    messageElement.className = "lb-status";
    messageElement.textContent = message;

    profilesGrid.appendChild(messageElement);
}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}


// ========================================
// PROFILE HELPERS
// ========================================

function getInterests(value) {
    if (Array.isArray(value)) {
        return value
            .map((interest) => String(interest).trim())
            .filter(Boolean);
    }

    if (typeof value === "string") {
        return value
            .split(/[,;]/)
            .map((interest) => interest.trim())
            .filter(Boolean);
    }

    return [];
}


function isValidAdultProfile(profile) {
    const age = Number(profile.age);

    return (
        typeof profile.fullName === "string" &&
        profile.fullName.trim().length > 0 &&
        Number.isFinite(age) &&
        age >= 18 &&
        age <= 120
    );
}


function isCompleteOwnProfile(profile) {
    return (
        isValidAdultProfile(profile) &&
        typeof profile.location === "string" &&
        typeof profile.bio === "string" &&
        typeof profile.interests === "string"
    );
}


function getTimestamp(value) {
    if (value && typeof value.seconds === "number") {
        return value.seconds;
    }

    if (value instanceof Date) {
        return value.getTime() / 1000;
    }

    return 0;
}


function isSafeImageURL(value) {
    if (typeof value !== "string" || !value.trim()) {
        return false;
    }

    try {
        const url = new URL(value);

        return url.protocol === "https:";
    } catch {
        return false;
    }
}


// ========================================
// CHECK PROFILE COMPLETION
// ========================================

async function checkMyProfile() {
    if (!currentUser || !profileCompletionNotice) {
        return;
    }

    try {
        const privateProfileReference = doc(
            db,
            "users",
            currentUser.uid
        );

        const publicProfileReference = doc(
            db,
            "publicProfiles",
            currentUser.uid
        );

        const [
            privateProfileSnapshot,
            publicProfileSnapshot
        ] = await Promise.all([
            getDoc(privateProfileReference),
            getDoc(publicProfileReference)
        ]);

        const privateProfile = privateProfileSnapshot.exists()
            ? privateProfileSnapshot.data()
            : {};

        const publicProfile = publicProfileSnapshot.exists()
            ? publicProfileSnapshot.data()
            : {};

        // Prefer the private profile when checking the user's
        // saved information.
        const myProfile = {
            ...publicProfile,
            ...privateProfile
        };

        const profileComplete = isCompleteOwnProfile(myProfile);

        // A completed profile must also be published to
        // publicProfiles before other members can discover it.
        const profilePublished =
            publicProfileSnapshot.exists() &&
            isValidAdultProfile(publicProfile);

        profileCompletionNotice.hidden =
            profileComplete && profilePublished;

        if (!profileComplete || !profilePublished) {
            console.log(
                "LoveBond: Your profile needs completion or publication."
            );
        }

    } catch (error) {
        console.error(
            "LoveBond profile completion check failed:",
            error.code,
            error.message
        );

        // If the profile cannot be checked, encourage the
        // member to visit the profile page.
        profileCompletionNotice.hidden = false;
    }
}


// ========================================
// LOAD USER LIKES
// ========================================

async function loadMyLikes() {
    likedUsers.clear();

    if (!currentUser) {
        return;
    }

    const likesQuery = query(
        collection(db, "likes"),
        where("likerId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(likesQuery);

    snapshot.forEach((likeDocument) => {
        const like = likeDocument.data();

        if (typeof like.likedId === "string") {
            likedUsers.add(like.likedId);
        }
    });
}


// ========================================
// LOAD PUBLIC PROFILES
// ========================================

async function loadProfiles() {
    if (!profilesGrid || !currentUser || profilesLoading) {
        return;
    }

    profilesLoading = true;

    showMessage("Loading members...");

    try {
        const profilesReference = collection(
            db,
            "publicProfiles"
        );

        const profilesSnapshot = await getDocs(
            profilesReference
        );

        allProfiles = [];

        profilesSnapshot.forEach((profileDocument) => {
            const profileData = profileDocument.data();

            // Never display the signed-in user's own profile.
            if (profileDocument.id === currentUser.uid) {
                return;
            }

            // Only show eligible adult profiles.
            if (!isValidAdultProfile(profileData)) {
                return;
            }

            allProfiles.push({
                ...profileData,
                uid: profileDocument.id,
                age: Number(profileData.age),
                interests: getInterests(profileData.interests)
            });
        });

        await loadMyLikes();

        renderProfiles();

        console.log(
            `LoveBond: Loaded ${allProfiles.length} public profiles.`
        );

    } catch (error) {
        console.error(
            "LoveBond profile loading error:",
            error.code,
            error.message
        );

        showMessage(
            error.code === "permission-denied"
                ? "Firebase denied access. Check your Firestore Security Rules."
                : "Unable to load members. Check your internet connection and browser console."
        );

    } finally {
        profilesLoading = false;
    }
}


// ========================================
// SEARCH AND FILTER PROFILES
// ========================================

function getFilteredProfiles() {
    const searchTerm = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const selectedFilter = filterSelect
        ? filterSelect.value
        : "everyone";

    let profiles = [...allProfiles];

    if (searchTerm) {
        profiles = profiles.filter((profile) => {
            const name = String(
                profile.fullName || ""
            ).toLowerCase();

            const location = String(
                profile.location || ""
            ).toLowerCase();

            const interests = profile.interests
                .join(" ")
                .toLowerCase();

            const bio = String(
                profile.bio || ""
            ).toLowerCase();

            return (
                name.includes(searchTerm) ||
                location.includes(searchTerm) ||
                interests.includes(searchTerm) ||
                bio.includes(searchTerm)
            );
        });
    }

    if (selectedFilter === "liked") {
        profiles = profiles.filter((profile) => {
            return likedUsers.has(profile.uid);
        });
    }

    if (selectedFilter === "new") {
        profiles.sort((first, second) => {
            return (
                getTimestamp(second.createdAt) -
                getTimestamp(first.createdAt)
            );
        });
    }

    return profiles;
}


// ========================================
// RENDER PROFILES
// ========================================

function renderProfiles() {
    if (!profilesGrid) {
        return;
    }

    const profiles = getFilteredProfiles();

    if (profiles.length === 0) {
        const searchTerm = searchInput
            ? searchInput.value.trim()
            : "";

        if (searchTerm) {
            showMessage("No profiles match your search.");
        } else if (
            filterSelect &&
            filterSelect.value === "liked"
        ) {
            showMessage(
                "You haven't liked any profiles yet. Explore members and tap Like!"
            );
        } else {
            showMessage(
                "No other eligible profiles are available yet."
            );
        }

        return;
    }

    profilesGrid.innerHTML = profiles
        .map(createProfileCard)
        .join("");

    attachLikeButtons();
}


// ========================================
// CREATE PROFILE CARDS
// ========================================

function createProfileCard(profile) {
    const uid = escapeHTML(profile.uid);
    const name = escapeHTML(profile.fullName);
    const age = escapeHTML(profile.age);

    const location = escapeHTML(
        profile.location || "Location not added"
    );

    const bio = escapeHTML(
        profile.bio || "This member has not added a bio yet."
    );

    const photoURL = isSafeImageURL(profile.photoURL)
        ? escapeHTML(profile.photoURL)
        : "";

    const isLiked = likedUsers.has(profile.uid);

    const interestsHTML = profile.interests
        .map((interest) => {
            return `
                <span class="interest-tag">
                    ${escapeHTML(interest)}
                </span>
            `;
        })
        .join("");

    const photoHTML = photoURL
        ? `
            <img
                src="${photoURL}"
                alt="${name}'s profile picture"
                loading="lazy"
                referrerpolicy="no-referrer"
                onerror="this.style.display='none'; this.nextElementSibling.hidden=false;"
            >

            <div
                class="profile-placeholder"
                hidden
                aria-label="Profile image unavailable"
            >
                ❤️
            </div>
        `
        : `
            <div
                class="profile-placeholder"
                aria-label="No profile picture"
            >
                ❤️
            </div>
        `;

    return `
        <article class="profile-card">

            <div class="profile-image">
                ${photoHTML}
            </div>

            <div class="profile-info">

                <h3>${name}, ${age}</h3>

                <p class="profile-location">
                    📍 ${location}
                </p>

                <p class="profile-bio">
                    ${bio}
                </p>

                <div class="profile-interests">
                    ${interestsHTML}
                </div>

                <div class="profile-actions">

                    <button
                        type="button"
                        class="like-button ${isLiked ? "liked" : ""}"
                        data-user-id="${uid}"
                        aria-pressed="${isLiked}"
                    >
                        ${isLiked ? "♥ Liked" : "♡ Like"}
                    </button>

                    <a
                        class="message-button"
                        href="messages.html?user=${encodeURIComponent(profile.uid)}"
                    >
                        Message
                    </a>

                </div>

            </div>

        </article>
    `;
}


// ========================================
// ATTACH LIKE BUTTON EVENTS
// ========================================

function attachLikeButtons() {
    if (!profilesGrid) {
        return;
    }

    const buttons = profilesGrid.querySelectorAll(
        ".like-button"
    );

    buttons.forEach((button) => {
        button.addEventListener("click", async () => {
            const targetUserId = button.dataset.userId;

            if (!targetUserId) {
                return;
            }

            await toggleLike(targetUserId, button);
        });
    });
}


// ========================================
// LIKE OR UNLIKE A PROFILE
// ========================================

async function toggleLike(targetUserId, button) {
    if (!currentUser) {
        alert("Please log in to like a profile.");
        return;
    }

    if (targetUserId === currentUser.uid) {
        return;
    }

    if (likeInProgress.has(targetUserId)) {
        return;
    }

    likeInProgress.add(targetUserId);
    button.disabled = true;

    try {
        const likeId = `${currentUser.uid}_${targetUserId}`;

        const likeReference = doc(
            db,
            "likes",
            likeId
        );

        const alreadyLiked = likedUsers.has(targetUserId);

        if (alreadyLiked) {
            await deleteDoc(likeReference);

            likedUsers.delete(targetUserId);

            console.log(
                "LoveBond: Like removed successfully."
            );

        } else {
            const targetProfileReference = doc(
                db,
                "publicProfiles",
                targetUserId
            );

            const targetProfileSnapshot = await getDoc(
                targetProfileReference
            );

            if (
                !targetProfileSnapshot.exists() ||
                !isValidAdultProfile(targetProfileSnapshot.data())
            ) {
                alert(
                    "This profile is no longer available. Refresh Discover and try again."
                );

                await loadProfiles();

                return;
            }

            await setDoc(likeReference, {
                likerId: currentUser.uid,
                likedId: targetUserId,
                createdAt: serverTimestamp()
            });

            likedUsers.add(targetUserId);

            const reverseLikeId =
                `${targetUserId}_${currentUser.uid}`;

            const reverseLikeReference = doc(
                db,
                "likes",
                reverseLikeId
            );

            const reverseLikeSnapshot = await getDoc(
                reverseLikeReference
            );

            if (reverseLikeSnapshot.exists()) {
                alert(
                    "It's a match! ❤️ You both liked each other."
                );

                console.log(
                    "LoveBond: Mutual like detected."
                );
            } else {
                alert("Like sent! ❤️");
            }
        }

        renderProfiles();

    } catch (error) {
        console.error(
            "LoveBond Like error:",
            error.code,
            error.message
        );

        if (error.code === "permission-denied") {
            alert(
                "Firebase denied this action. Check the Likes Firestore rules."
            );
        } else {
            alert(
                "Unable to process this Like. Check your internet connection and browser console."
            );
        }

    } finally {
        likeInProgress.delete(targetUserId);

        if (button.isConnected) {
            button.disabled = false;
        }
    }
}


// ========================================
// SEARCH EVENTS
// ========================================

if (searchInput) {
    searchInput.addEventListener(
        "input",
        renderProfiles
    );
}


// ========================================
// FILTER EVENTS
// ========================================

if (filterSelect) {
    filterSelect.addEventListener(
        "change",
        renderProfiles
    );
}


// ========================================
// AUTHENTICATION
// ========================================

onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (!user) {
        allProfiles = [];
        likedUsers.clear();

        if (welcomePanel) {
            welcomePanel.hidden = true;
        }

        if (profileCompletionNotice) {
            profileCompletionNotice.hidden = true;
        }

        showMessage(
            "Please log in to discover members."
        );

        return;
    }

    if (welcomePanel) {
        welcomePanel.hidden = false;
    }

    if (welcomeName) {
        welcomeName.textContent =
            user.displayName || "Member";
    }

    // Check the current user's profile separately from
    // loading other members.
    await checkMyProfile();

    // Incomplete users can still browse eligible members.
    await loadProfiles();
});

console.log("LoveBond Discover system ready ❤️");