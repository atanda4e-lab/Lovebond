import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* ========================================
   LOVE BOND LETTERS
======================================== */

const letterForm = document.getElementById("letter-form");

const titleInput = document.getElementById("letter-title");
const recipientInput = document.getElementById("letter-recipient");
const bodyInput = document.getElementById("letter-body");
const signatureInput = document.getElementById("letter-signature");

const saveButton = document.getElementById("save-letter");
const formMessage = document.getElementById("form-message");
const characterCount = document.getElementById("character-count");

const previewTitle = document.getElementById("preview-title");
const previewRecipient = document.getElementById("preview-recipient");
const previewBody = document.getElementById("preview-body");
const previewSignature = document.getElementById("preview-signature");

const savedGrid = document.getElementById("saved-grid");
const savedCount = document.getElementById("saved-count");
const emptyState = document.getElementById("empty-state");

const toast = document.getElementById("toast");
const loginLink = document.querySelector(".login-link");

const emptyHeading = emptyState.querySelector("h3");
const emptyParagraph = emptyState.querySelector("p");


/* ========================================
   APPLICATION STATE
======================================== */

let currentUser = null;
let isSaving = false;
let isLoading = false;
let toastTimeout = null;
let authReady = false;


/* ========================================
   INITIAL SETUP
======================================== */

document.getElementById("current-year").textContent =
    new Date().getFullYear();

saveButton.disabled = true;


/* ========================================
   TOAST NOTIFICATION
======================================== */

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


/* ========================================
   FORM PREVIEW
======================================== */

function updatePreview() {
    previewTitle.textContent =
        titleInput.value.trim() || "A Letter From My Heart";

    const recipient = recipientInput.value.trim();

    previewRecipient.textContent = recipient
        ? `Dear ${recipient},`
        : "Dear Someone Special,";

    previewBody.textContent =
        bodyInput.value ||
        "Your words will appear here as you write your letter.\n\nEvery word can become a memory worth keeping.";

    previewSignature.textContent =
        signatureInput.value.trim() || "With love, ♥";

    characterCount.textContent =
        `${bodyInput.value.length} / 10000 characters`;
}


[
    titleInput,
    recipientInput,
    bodyInput,
    signatureInput
].forEach(input => {
    input.addEventListener("input", updatePreview);
});


/* ========================================
   VALIDATE LETTER
======================================== */

function validateLetter() {
    const title = titleInput.value.trim();
    const recipient = recipientInput.value.trim();
    const body = bodyInput.value.trim();
    const signature = signatureInput.value.trim();

    if (!title || !recipient || !body || !signature) {
        formMessage.textContent =
            "Please complete all the fields before saving.";

        return false;
    }

    if (
        title.length > 100 ||
        recipient.length > 100 ||
        signature.length > 100 ||
        body.length > 10000
    ) {
        formMessage.textContent =
            "One or more fields exceed the allowed length.";

        return false;
    }

    return true;
}


/* ========================================
   FIRESTORE COLLECTION
======================================== */

function getLettersCollection() {
    if (!currentUser) {
        throw new Error("No authenticated user.");
    }

    return collection(
        db,
        "users",
        currentUser.uid,
        "letters"
    );
}


/* ========================================
   UPDATE LOGIN LINK
======================================== */

function updateLoginLink(user) {
    if (!loginLink) {
        return;
    }

    if (user) {
        loginLink.textContent = "My Account";

        // Change this to your actual profile/dashboard page.
        loginLink.href = "profile.html";
    } else {
        loginLink.textContent = "Login";
        loginLink.href = "login.html";
    }
}


/* ========================================
   SHOW SIGNED-OUT STATE
======================================== */

function showSignedOutState() {
    savedGrid.replaceChildren();

    savedCount.textContent = "Login required";

    emptyState.hidden = false;

    emptyHeading.textContent = "Your letters are waiting";

    emptyParagraph.textContent =
        "Log in to your LoveBond account to save and view your private letters.";

    saveButton.disabled = true;

    formMessage.textContent =
        "Please log in to save your letters.";
}


/* ========================================
   SAVE LETTER
======================================== */

letterForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (isSaving) {
        return;
    }

    if (!authReady) {
        formMessage.textContent =
            "Checking your LoveBond login session. Please wait.";

        return;
    }

    if (!currentUser) {
        formMessage.textContent =
            "Please log in to save your letter.";

        showToast("Log in to save your personal letters.");

        return;
    }

    if (!validateLetter()) {
        return;
    }

    const letter = {
        title: titleInput.value.trim(),
        recipient: recipientInput.value.trim(),
        body: bodyInput.value.trim(),
        signature: signatureInput.value.trim(),
        createdAt: serverTimestamp()
    };

    isSaving = true;

    saveButton.disabled = true;
    saveButton.textContent = "Saving Letter...";

    formMessage.textContent = "Saving your letter securely...";

    try {
        await addDoc(getLettersCollection(), letter);

        formMessage.textContent =
            "Your letter has been saved successfully. ♥";

        showToast("Your love letter has been saved! 💌");

        letterForm.reset();

        updatePreview();

        await loadLetters();

    } catch (error) {
        console.error("Error saving letter:", error);

        if (error.code === "permission-denied") {
            formMessage.textContent =
                "Access denied. Check your Firestore Rules.";
        } else {
            formMessage.textContent =
                "Unable to save your letter. Check your connection and try again.";
        }

        showToast("Unable to save your letter.");

    } finally {
        isSaving = false;

        saveButton.disabled = !currentUser;

        saveButton.textContent = "Save My Letter ♥";
    }
});


/* ========================================
   FORMAT DATE
======================================== */

function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Recently created";
    }

    return timestamp.toDate().toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


/* ========================================
   LOAD SAVED LETTERS
======================================== */

async function loadLetters() {
    if (!currentUser || isLoading) {
        return;
    }

    isLoading = true;

    savedGrid.replaceChildren();

    emptyState.hidden = true;

    const loadingMessage = document.createElement("p");

    loadingMessage.textContent = "Loading your letters...";

    savedGrid.appendChild(loadingMessage);

    try {
        const lettersQuery = query(
            getLettersCollection(),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(lettersQuery);

        // Avoid displaying one user's results after an account change.
        if (!currentUser) {
            return;
        }

        savedGrid.replaceChildren();

        savedCount.textContent =
            `${snapshot.size} ${snapshot.size === 1 ? "letter" : "letters"}`;

        if (snapshot.empty) {
            emptyState.hidden = false;

            emptyHeading.textContent = "Your story starts here";

            emptyParagraph.textContent =
                "You haven't saved any letters yet. Write your first letter and it will appear here.";

            return;
        }

        emptyState.hidden = true;

        snapshot.forEach(letterDocument => {
            const card = createLetterCard(
                letterDocument.id,
                letterDocument.data()
            );

            savedGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading letters:", error);

        savedGrid.replaceChildren();

        savedCount.textContent = "Letters unavailable";

        const errorMessage = document.createElement("p");

        errorMessage.textContent =
            error.code === "permission-denied"
                ? "Access denied. Check your Firestore Rules for users/{userId}/letters/{letterId}."
                : "Unable to load your letters. Check your internet connection and try again.";

        savedGrid.appendChild(errorMessage);

    } finally {
        isLoading = false;
    }
}


/* ========================================
   CREATE SAVED LETTER CARD
======================================== */

function createLetterCard(id, letter) {
    const card = document.createElement("article");

    card.className = "saved-letter";

    const icon = document.createElement("div");

    icon.className = "saved-letter-icon";
    icon.textContent = "💌";

    const title = document.createElement("h3");

    title.textContent = letter.title || "Untitled Letter";

    const recipient = document.createElement("p");

    recipient.className = "saved-recipient";

    recipient.textContent =
        `To: ${letter.recipient || "Someone Special"}`;

    const excerpt = document.createElement("p");

    excerpt.className = "saved-excerpt";

    excerpt.textContent = letter.body || "";

    const date = document.createElement("p");

    date.className = "saved-date";

    date.textContent = formatDate(letter.createdAt);

    const actions = document.createElement("div");

    actions.className = "saved-actions";

    const viewButton = document.createElement("button");

    viewButton.type = "button";
    viewButton.className = "small-button";
    viewButton.textContent = "View Letter";

    viewButton.addEventListener("click", () => {
        viewLetter(letter);
    });

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "small-button delete-button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", async () => {
        await deleteLetter(id, deleteButton);
    });

    actions.append(viewButton, deleteButton);

    card.append(
        icon,
        title,
        recipient,
        excerpt,
        date,
        actions
    );

    return card;
}


/* ========================================
   VIEW SAVED LETTER
======================================== */

function viewLetter(letter) {
    titleInput.value = letter.title || "";
    recipientInput.value = letter.recipient || "";
    bodyInput.value = letter.body || "";
    signatureInput.value = letter.signature || "";

    updatePreview();

    document.getElementById("write-letter").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    showToast("Your saved letter is displayed in the editor.");
}


/* ========================================
   DELETE SAVED LETTER
======================================== */

async function deleteLetter(id, button) {
    if (!currentUser) {
        showToast("Please log in to manage your letters.");
        return;
    }

    if (!window.confirm(
        "Are you sure you want to permanently delete this letter?"
    )) {
        return;
    }

    button.disabled = true;
    button.textContent = "Deleting...";

    try {
        await deleteDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "letters",
                id
            )
        );

        showToast("Your letter has been deleted.");

        await loadLetters();

    } catch (error) {
        console.error("Error deleting letter:", error);

        showToast(
            error.code === "permission-denied"
                ? "Access denied. Check your Firestore Rules."
                : "Unable to delete this letter."
        );

        button.disabled = false;
        button.textContent = "Delete";
    }
}


/* ========================================
   FIREBASE AUTHENTICATION
======================================== */

onAuthStateChanged(auth, async user => {
    currentUser = user;
    authReady = true;

    updateLoginLink(user);

    if (!user) {
        showSignedOutState();
        return;
    }

    saveButton.disabled = false;

    formMessage.textContent =
        "You're signed in. Your letters will be saved privately to your account.";

    await loadLetters();
});


/* ========================================
   INITIAL PREVIEW
======================================== */

updatePreview();