import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const searchInput = document.getElementById("searchInput");
const peopleGrid = document.getElementById("peopleGrid");
const statusMessage = document.getElementById("statusMessage");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;
let peopleWhoLikeMe = [];

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    await loadLikes();
});

searchInput.addEventListener("input", renderPeople);

logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout failed:", error);
        alert("Unable to log out. Please try again.");
    }
});

async function loadLikes() {
    showStatus("Loading people who like you...");

    try {
        const likesQuery = query(
            collection(db, "likes"),
            where("likedId", "==", currentUser.uid)
        );

        const likesSnapshot = await getDocs(likesQuery);
        const userIds = new Set();

        likesSnapshot.forEach((likeDocument) => {
            const data = likeDocument.data();

            if (data.likerId && data.likerId !== currentUser.uid) {
                userIds.add(data.likerId);
            }
        });

        const profiles = await Promise.all(
            [...userIds].map(async (uid) => {
                try {
                    const profileRef = doc(db, "publicProfiles", uid);
                    const profileSnapshot = await getDoc(profileRef);

                    if (!profileSnapshot.exists()) {
                        console.warn("Public profile not found:", uid);
                        return null;
                    }

                    return {
                        uid,
                        ...profileSnapshot.data()
                    };
                } catch (error) {
                    console.error("Profile loading failed:", uid, error);
                    return null;
                }
            })
        );

        peopleWhoLikeMe = profiles.filter(Boolean);

        console.log("People who like you loaded:", peopleWhoLikeMe.length);

        renderPeople();
    } catch (error) {
        console.error("Failed to load people who like you:", error);

        showStatus(
            "Unable to load people who like you. Please check your connection and try again.",
            true
        );
    }
}

function getPersonName(person) {
    return (
        person.displayName ||
        person.fullName ||
        person.name ||
        person.username ||
        person.firstName ||
        "LoveBond Member"
    );
}

function getPersonPhoto(person) {
    return (
        person.photoURL ||
        person.photoUrl ||
        person.profilePicture ||
        person.profilePhoto ||
        person.avatar ||
        person.photo ||
        ""
    );
}

function getPersonDetails(person) {
    const details = [
        person.age ? `${person.age} years old` : "",
        person.city || person.location || "",
        person.bio || person.about || ""
    ].filter(Boolean);

    return details.length
        ? details.join(" · ")
        : "Someone would like to get to know you.";
}

function createPersonCard(person) {
    const card = document.createElement("article");
    card.className = "person-card";

    const photoContainer = document.createElement("div");
    photoContainer.className = "person-photo";

    const photoUrl = getPersonPhoto(person);

    if (photoUrl) {
        const image = document.createElement("img");

        image.src = photoUrl;
        image.alt = getPersonName(person);
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.remove();
            photoContainer.textContent = "💕";
        });

        photoContainer.appendChild(image);
    } else {
        photoContainer.textContent = "💕";
    }

    const info = document.createElement("div");
    info.className = "person-info";

    const name = document.createElement("h3");
    name.textContent = getPersonName(person);

    const details = document.createElement("p");
    details.textContent = getPersonDetails(person);

    const actions = document.createElement("div");
    actions.className = "person-actions";

    const profileButton = document.createElement("a");
    profileButton.className = "button button-secondary";
    profileButton.href =
        `profile.html?uid=${encodeURIComponent(person.uid)}`;
    profileButton.textContent = "View Profile";

    const messageButton = document.createElement("a");
    messageButton.className = "button button-primary";
    messageButton.href =
        `messages.html?uid=${encodeURIComponent(person.uid)}`;
    messageButton.textContent = "Send Message";

    actions.append(profileButton, messageButton);
    info.append(name, details, actions);
    card.append(photoContainer, info);

    return card;
}

function renderPeople() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filteredPeople = peopleWhoLikeMe.filter((person) => {
        const searchableText = [
            getPersonName(person),
            person.city || "",
            person.location || "",
            person.bio || "",
            person.about || ""
        ].join(" ").toLowerCase();

        return searchableText.includes(searchTerm);
    });

    peopleGrid.replaceChildren();

    if (filteredPeople.length === 0) {
        showStatus(
            searchTerm
                ? "No people match your search."
                : "Nobody has liked your profile yet. Check back soon! ❤️"
        );

        return;
    }

    filteredPeople.forEach((person) => {
        peopleGrid.appendChild(createPersonCard(person));
    });

    statusMessage.hidden = true;
    peopleGrid.hidden = false;
}

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
    statusMessage.hidden = false;
    peopleGrid.hidden = true;
}