// ==========================================
// LOVE BOND MESSAGING SYSTEM
// ==========================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    doc,
    getDocs,
    setDoc,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// ==========================================
// HTML ELEMENTS
// ==========================================

const contactsList = document.getElementById("contactsList");

const contactSearch = document.getElementById("contactSearch");

const chatName = document.getElementById("chatName");

const chatSubtitle = document.getElementById("chatSubtitle");

const chatAvatar = document.getElementById("chatAvatar");

const chatStatus = document.getElementById("chatStatus");

const chatMessages = document.getElementById("chatMessages");

const chatPlaceholder = document.getElementById("chatPlaceholder");

const messageForm = document.getElementById("messageForm");

const messageInput = document.getElementById("messageInput");

const sendButton = document.getElementById("sendButton");

const logoutButton = document.getElementById("logoutButton");

const pageStatus = document.getElementById("pageStatus");

const messagesLayout = document.getElementById("messagesLayout");


// ==========================================
// APPLICATION STATE
// ==========================================

let currentUser = null;

let allMembers = [];

let selectedMember = null;

let currentChatId = null;

let unsubscribeMessages = null;

let unsubscribeChat = null;

let isSending = false;


// ==========================================
// DISPLAY STATUS
// ==========================================

function showStatus(message) {

    pageStatus.textContent = message;

    pageStatus.classList.add("visible");

}

function hideStatus() {

    pageStatus.textContent = "";

    pageStatus.classList.remove("visible");

}


// ==========================================
// SAFE TEXT HELPERS
// ==========================================

function getMemberName(member) {

    return (
        member.displayName ||
        member.fullName ||
        member.name ||
        member.username ||
        member.email ||
        "LoveBond Member"
    );

}

function getMemberPhoto(member) {

    return (
        member.photoURL ||
        member.photoUrl ||
        member.profilePicture ||
        member.profileImage ||
        member.avatar ||
        ""
    );

}

function getMemberId(member) {

    return member.uid || member.id || "";

}

function getInitial(name) {

    return name.trim().charAt(0).toUpperCase() || "U";

}

function createAvatar(member, className) {

    const avatar = document.createElement("div");

    avatar.className = className;

    const photo = getMemberPhoto(member);

    if (photo) {

        const image = document.createElement("img");

        image.src = photo;

        image.alt = getMemberName(member);

        image.referrerPolicy = "no-referrer";

        image.addEventListener("error", function () {

            avatar.replaceChildren();

            avatar.textContent = getInitial(getMemberName(member));

        });

        avatar.appendChild(image);

    } else {

        avatar.textContent = getInitial(getMemberName(member));

    }

    return avatar;

}


// ==========================================
// CREATE A CHAT ID
// ==========================================

function createChatId(firstUserId, secondUserId) {

    return [firstUserId, secondUserId]
        .sort()
        .join("_");

}


// ==========================================
// LOAD PUBLIC USER PROFILES
// ==========================================

async function loadMembers() {

    contactsList.replaceChildren();

    const loadingMessage = document.createElement("div");

    loadingMessage.className = "empty-contacts";

    loadingMessage.textContent = "Loading users...";

    contactsList.appendChild(loadingMessage);

    try {

        const profilesReference = collection(db, "publicProfiles");

        const profilesSnapshot = await getDocs(profilesReference);

        allMembers = [];

        profilesSnapshot.forEach(function (profileDocument) {

            const profileData = profileDocument.data();

            const member = {
                ...profileData,
                id: profileDocument.id
            };

            const memberId = getMemberId(member);

            // Do not display the currently signed-in user.
            if (!memberId || memberId === currentUser.uid) {
                return;
            }

            allMembers.push(member);

        });

        renderMembers(allMembers);

        if (allMembers.length === 0) {

            showStatus(
                "No other user profiles were found. " +
                "Check that other users have publicProfiles documents."
            );

        } else {

            hideStatus();

        }

    } catch (error) {

        console.error("LoveBond: Failed to load user profiles:", error);

        contactsList.replaceChildren();

        const errorMessage = document.createElement("div");

        errorMessage.className = "empty-contacts";

        errorMessage.textContent =
            "Unable to load users. Check your Firestore rules and console.";

        contactsList.appendChild(errorMessage);

        showStatus(
            "The user list could not be loaded. " +
            "Your Firestore permissions may need checking."
        );

    }

}


// ==========================================
// DISPLAY USER LIST
// ==========================================

function renderMembers(members) {

    contactsList.replaceChildren();

    if (members.length === 0) {

        const emptyMessage = document.createElement("div");

        emptyMessage.className = "empty-contacts";

        emptyMessage.textContent =
            allMembers.length === 0
                ? "No other users are available yet."
                : "No users match your search.";

        contactsList.appendChild(emptyMessage);

        return;

    }

    members.forEach(function (member) {

        const memberId = getMemberId(member);

        const memberName = getMemberName(member);

        const contactButton = document.createElement("button");

        contactButton.type = "button";

        contactButton.className = "contact-item";

        contactButton.dataset.userId = memberId;

        if (
            selectedMember &&
            getMemberId(selectedMember) === memberId
        ) {
            contactButton.classList.add("active");
        }

        const avatar = createAvatar(member, "contact-avatar");

        const info = document.createElement("div");

        info.className = "contact-info";

        const name = document.createElement("div");

        name.className = "contact-name";

        name.textContent = memberName;

        const preview = document.createElement("div");

        preview.className = "contact-preview";

        preview.textContent = "Select to view messages";

        info.append(name, preview);

        contactButton.append(avatar, info);

        contactButton.addEventListener("click", function () {

            openConversation(member);

        });

        contactsList.appendChild(contactButton);

    });

}


// ==========================================
// SEARCH USERS
// ==========================================

contactSearch.addEventListener("input", function () {

    const searchTerm = contactSearch.value
        .trim()
        .toLowerCase();

    const filteredMembers = allMembers.filter(function (member) {

        const name = getMemberName(member).toLowerCase();

        const username = String(member.username || "").toLowerCase();

        return (
            name.includes(searchTerm) ||
            username.includes(searchTerm)
        );

    });

    renderMembers(filteredMembers);

});


// ==========================================
// OPEN A CONVERSATION
// ==========================================

async function openConversation(member) {

    if (!currentUser) {
        showStatus("Please sign in to use messages.");
        return;
    }

    const otherUserId = getMemberId(member);

    if (!otherUserId || otherUserId === currentUser.uid) {
        return;
    }

    // Stop listening to the previously selected chat.
    stopChatListeners();

    selectedMember = member;

    currentChatId = createChatId(
        currentUser.uid,
        otherUserId
    );

    renderMembers(
        allMembers.filter(function (item) {
            return true;
        })
    );

    // Highlight the selected contact.
    document.querySelectorAll(".contact-item").forEach(function (item) {

        item.classList.toggle(
            "active",
            item.dataset.userId === otherUserId
        );

    });

    chatName.textContent = getMemberName(member);

    chatSubtitle.textContent = "Private conversation";

    chatAvatar.replaceWith(
        createAvatar(member, "chat-avatar")
    );

    // The replacement above creates a new avatar element.
    // Keep the expected ID for subsequent conversations.
    const newAvatar = document.querySelector(".chat-header .chat-avatar");

    if (newAvatar) {
        newAvatar.id = "chatAvatar";
    }

    chatStatus.textContent = "LoveBond";

    chatMessages.replaceChildren();

    const loading = document.createElement("div");

    loading.className = "chat-placeholder";

    loading.textContent = "Loading messages...";

    chatMessages.appendChild(loading);

    sendButton.disabled = false;

    messageInput.disabled = false;

    if (window.innerWidth <= 700 && messagesLayout) {
        messagesLayout.classList.add("chat-open");
    }

    try {

        const chatReference = doc(db, "chats", currentChatId);

        // Create the chat document if it does not exist.
        await setDoc(
            chatReference,
            {
                participants: [
                    currentUser.uid,
                    otherUserId
                ].sort(),

                updatedAt: serverTimestamp()
            },
            {
                merge: true
            }
        );

        // The user may have switched conversations while this
        // request was running.
        if (currentChatId !== createChatId(currentUser.uid, otherUserId)) {
            return;
        }

        listenForMessages(currentChatId);

    } catch (error) {

        console.error("LoveBond: Unable to open conversation:", error);

        chatMessages.replaceChildren();

        showStatus(
            "Unable to open this conversation. " +
            "Check your Firestore security rules."
        );

        sendButton.disabled = true;

    }

}


// ==========================================
// LISTEN TO MESSAGES IN REAL TIME
// ==========================================

function listenForMessages(chatId) {

    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

    const messagesReference = collection(
        db,
        "chats",
        chatId,
        "messages"
    );

    const messagesQuery = query(
        messagesReference,
        orderBy("createdAt", "asc")
    );

    unsubscribeMessages = onSnapshot(
        messagesQuery,

        function (snapshot) {

            if (chatId !== currentChatId) {
                return;
            }

            chatMessages.replaceChildren();

            if (snapshot.empty) {

                const emptyMessage = document.createElement("div");

                emptyMessage.className = "chat-placeholder";

                emptyMessage.textContent = "No messages yet.";

                chatMessages.appendChild(emptyMessage);

                return;

            }

            snapshot.forEach(function (messageDocument) {

                const message = messageDocument.data();

                renderMessage(message);

            });

            scrollMessagesToBottom();

        },

        function (error) {

            console.error(
                "LoveBond: Message listener failed:",
                error
            );

            if (chatId === currentChatId) {

                showStatus(
                    "Unable to load messages. " +
                    "Check your Firestore security rules."
                );

            }

        }
    );

}


// ==========================================
// DISPLAY A MESSAGE
// ==========================================

function renderMessage(message) {

    const senderId = message.senderId || "";

    const messageText = message.text || "";

    const messageElement = document.createElement("div");

    messageElement.className =
        "message-bubble " +
        (
            senderId === currentUser.uid
                ? "sent"
                : "received"
        );

    const textElement = document.createElement("div");

    // textContent prevents message text from being interpreted as HTML.
    textElement.textContent = messageText;

    messageElement.appendChild(textElement);

    const timeElement = document.createElement("span");

    timeElement.className = "message-time";

    timeElement.textContent = formatTimestamp(message.createdAt);

    messageElement.appendChild(timeElement);

    chatMessages.appendChild(messageElement);

}


// ==========================================
// FORMAT MESSAGE TIME
// ==========================================

function formatTimestamp(timestamp) {

    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Sending...";
    }

    const date = timestamp.toDate();

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

}


// ==========================================
// SCROLL TO THE LATEST MESSAGE
// ==========================================

function scrollMessagesToBottom() {

    chatMessages.scrollTop = chatMessages.scrollHeight;

}


// ==========================================
// SEND A TEXT MESSAGE
// ==========================================

messageForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (!currentUser || !selectedMember || !currentChatId) {

        showStatus("Select a user before sending a message.");

        return;

    }

    if (isSending) {
        return;
    }

    const text = messageInput.value.trim();

    if (!text) {
        return;
    }

    const receiverId = getMemberId(selectedMember);

    if (!receiverId) {
        showStatus("The selected user's ID could not be found.");
        return;
    }

    isSending = true;

    sendButton.disabled = true;

    try {

        const chatId = currentChatId;

        const messageReference = collection(
            db,
            "chats",
            chatId,
            "messages"
        );

        await addDoc(
            messageReference,
            {
                senderId: currentUser.uid,

                receiverId: receiverId,

                text: text,

                type: "text",

                createdAt: serverTimestamp()
            }
        );

        // Update the chat preview and timestamp.
        await setDoc(
            doc(db, "chats", chatId),
            {
                participants: [
                    currentUser.uid,
                    receiverId
                ].sort(),

                lastMessage: text,

                lastMessageAt: serverTimestamp(),

                updatedAt: serverTimestamp()
            },
            {
                merge: true
            }
        );

        // Clear the input only after the message has been saved.
        if (chatId === currentChatId) {

            messageInput.value = "";

            messageInput.focus();

        }

        hideStatus();

    } catch (error) {

        console.error("LoveBond: Failed to send message:", error);

        showStatus(
            "Your message could not be sent. " +
            "Check your internet connection and Firestore rules."
        );

    } finally {

        isSending = false;

        sendButton.disabled = !selectedMember;

    }

});


// ==========================================
// STOP CHAT LISTENERS
// ==========================================

function stopChatListeners() {

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;

    }

    if (unsubscribeChat) {

        unsubscribeChat();

        unsubscribeChat = null;

    }

}


// ==========================================
// LOGOUT
// ==========================================

logoutButton.addEventListener("click", async function () {

    const confirmLogout = confirm(
        "Are you sure you want to log out of LoveBond?"
    );

    if (!confirmLogout) {
        return;
    }

    logoutButton.disabled = true;

    logoutButton.textContent = "Logging out...";

    try {

        stopChatListeners();

        await signOut(auth);

        window.location.href = "login.html";

    } catch (error) {

        console.error("LoveBond: Logout failed:", error);

        alert("Unable to log out. Please try again.");

        logoutButton.disabled = false;

        logoutButton.textContent = "↪ Logout";

    }

});


// ==========================================
// AUTHENTICATION
// ==========================================

onAuthStateChanged(auth, async function (user) {

    if (!user) {

        stopChatListeners();

        window.location.href = "login.html";

        return;

    }

    currentUser = user;

    await loadMembers();

});


// ==========================================
// INITIALIZE
// ==========================================

messageInput.disabled = true;

sendButton.disabled = true;

console.log("LoveBond: Messaging page initialized.");