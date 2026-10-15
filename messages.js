// ==========================================
// LOVE BOND MESSAGING SYSTEM
// UNREAD BADGES + ONLINE/OFFLINE PRESENCE
// ==========================================

import { auth, db, rtdb } from "./firebase.js";

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

import {
    ref,
    set,
    onValue,
    onDisconnect,
    serverTimestamp as databaseServerTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


// ==========================================
// HTML ELEMENTS
// ==========================================

const contactsList = document.getElementById("contactsList");
const contactSearch = document.getElementById("contactSearch");

const chatName = document.getElementById("chatName");
const chatSubtitle = document.getElementById("chatSubtitle");
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
let unsubscribeConnection = null;

let isSending = false;

// Unread message counts.
const unreadCounts = {};

// Unread message listeners.
const unreadListeners = {};

// Presence listeners for other members.
const presenceListeners = {};

// Current online status for each member.
const memberPresence = {};

// Tracks the currently active user's presence reference.
let ownPresenceReference = null;


// ==========================================
// STATUS MESSAGES
// ==========================================

function showStatus(message) {
    if (!pageStatus) return;

    pageStatus.textContent = message;
    pageStatus.classList.add("visible");
}

function hideStatus() {
    if (!pageStatus) return;

    pageStatus.textContent = "";
    pageStatus.classList.remove("visible");
}


// ==========================================
// MEMBER HELPERS
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


// ==========================================
// CREATE AVATAR
// ==========================================

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

            avatar.textContent = getInitial(
                getMemberName(member)
            );
        });

        avatar.appendChild(image);
    } else {
        avatar.textContent = getInitial(
            getMemberName(member)
        );
    }

    return avatar;
}


// ==========================================
// CREATE CHAT ID
// ==========================================

function createChatId(firstUserId, secondUserId) {
    return [firstUserId, secondUserId]
        .sort()
        .join("_");
}


// ==========================================
// UNREAD BADGE AND PRESENCE STYLES
// ==========================================

function addMessagingStyles() {
    if (document.getElementById("lovebondMessagingStyles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "lovebondMessagingStyles";

    style.textContent = `
        .contact-item {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .contact-info {
            flex: 1;
            min-width: 0;
        }

        .contact-presence {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            margin-top: 4px;
        }

        .contact-presence-dot {
            width: 8px;
            height: 8px;
            display: inline-block;
            border-radius: 50%;
            flex-shrink: 0;
            background: #8b8490;
        }

        .contact-presence-dot.online {
            background: #35d07f;
            box-shadow: 0 0 6px rgba(53, 208, 127, 0.5);
        }

        .contact-presence-dot.offline {
            background: #8b8490;
            box-shadow: none;
        }

        .contact-presence-text.online {
            color: #35d07f;
        }

        .contact-presence-text.offline {
            color: #b6a7bd;
        }

        .contact-unread-badge {
            display: none;
            align-items: center;
            justify-content: center;
            min-width: 22px;
            height: 22px;
            padding: 0 6px;
            margin-left: auto;
            border-radius: 50px;
            background: #e53945;
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            flex-shrink: 0;
        }

        .contact-unread-badge.has-unread {
            display: inline-flex;
        }

        #chatStatus.online {
            color: #35d07f !important;
        }

        #chatStatus.offline {
            color: #b6a7bd !important;
        }
    `;

    document.head.appendChild(style);
}


// ==========================================
// ONLINE STATUS HELPERS
// ==========================================

function isMemberOnline(userId) {
    return memberPresence[userId] === true;
}


// ==========================================
// UPDATE CHAT HEADER PRESENCE
// ==========================================

function updateChatPresence(userId) {
    if (!selectedMember || !chatStatus) {
        return;
    }

    if (getMemberId(selectedMember) !== userId) {
        return;
    }

    const online = isMemberOnline(userId);

    chatStatus.textContent = online
        ? "🟢 Online"
        : "⚫ Offline";

    chatStatus.classList.toggle("online", online);
    chatStatus.classList.toggle("offline", !online);

    chatStatus.setAttribute(
        "aria-label",
        online ? "User is online" : "User is offline"
    );
}


// ==========================================
// UPDATE A CONTACT'S PRESENCE
// ==========================================

function updateContactPresence(userId, online) {
    const contact = contactsList.querySelector(
        `.contact-item[data-user-id="${CSS.escape(userId)}"]`
    );

    if (contact) {
        const dot = contact.querySelector(
            ".contact-presence-dot"
        );

        const statusText = contact.querySelector(
            ".contact-presence-text"
        );

        if (dot) {
            dot.classList.toggle("online", online);
            dot.classList.toggle("offline", !online);
        }

        if (statusText) {
            statusText.textContent = online
                ? "Online"
                : "Offline";

            statusText.classList.toggle("online", online);
            statusText.classList.toggle("offline", !online);
        }
    }

    updateChatPresence(userId);
}


// ==========================================
// START CURRENT USER PRESENCE
// ==========================================

function startOwnPresence() {
    if (!currentUser) {
        return;
    }

    // Stop the previous connection listener if necessary.
    if (unsubscribeConnection) {
        unsubscribeConnection();
        unsubscribeConnection = null;
    }

    const userId = currentUser.uid;

    ownPresenceReference = ref(
        rtdb,
        `presence/${userId}`
    );

    const connectionReference = ref(
        rtdb,
        ".info/connected"
    );

    unsubscribeConnection = onValue(
        connectionReference,

        async function (snapshot) {
            // Firebase reports whether this client is
            // connected to Realtime Database.
            if (snapshot.val() !== true) {
                return;
            }

            // The signed-in user may have changed while
            // this connection callback was running.
            if (
                !currentUser ||
                currentUser.uid !== userId
            ) {
                return;
            }

            try {
                // Ask Firebase to mark this user offline
                // if the database connection disconnects.
                await onDisconnect(
                    ownPresenceReference
                ).set({
                    online: false,
                    lastChanged: databaseServerTimestamp()
                });

                // Do not write online for an outdated user.
                if (
                    !currentUser ||
                    currentUser.uid !== userId
                ) {
                    return;
                }

                // Mark the current user online.
                await set(
                    ownPresenceReference,
                    {
                        online: true,
                        lastChanged: databaseServerTimestamp()
                    }
                );

                console.log(
                    "LoveBond: Presence active."
                );

            } catch (error) {
                console.error(
                    "LoveBond: Unable to update presence:",
                    error
                );

                showStatus(
                    "Unable to update online status. " +
                    "Check your Realtime Database rules."
                );
            }
        },

        function (error) {
            console.error(
                "LoveBond: Connection listener failed:",
                error
            );

            showStatus(
                "Online status is temporarily unavailable."
            );
        }
    );
}


// ==========================================
// LISTEN TO OTHER MEMBERS' PRESENCE
// ==========================================

function stopPresenceListeners() {
    Object.keys(presenceListeners).forEach(
        function (userId) {
            presenceListeners[userId]();
            delete presenceListeners[userId];
        }
    );
}

function listenForMemberPresence() {
    if (!currentUser) {
        return;
    }

    // Remove any listeners from a previous member list.
    stopPresenceListeners();

    allMembers.forEach(function (member) {
        const userId = getMemberId(member);

        if (
            !userId ||
            userId === currentUser.uid
        ) {
            return;
        }

        const presenceReference = ref(
            rtdb,
            `presence/${userId}`
        );

        presenceListeners[userId] = onValue(
            presenceReference,

            function (snapshot) {
                const presence = snapshot.val();

                // A missing record means that the user
                // has not established a presence record.
                const online = Boolean(
                    presence &&
                    presence.online === true
                );

                memberPresence[userId] = online;

                updateContactPresence(
                    userId,
                    online
                );
            },

            function (error) {
                console.error(
                    "LoveBond: Could not read member presence:",
                    userId,
                    error
                );
            }
        );
    });
}


// ==========================================
// SAVE LAST-READ MESSAGE
// ==========================================

function getReadMarkerKey(chatId) {
    return `lovebond_last_read_${currentUser.uid}_${chatId}`;
}

function saveLastReadMessage(chatId, messageId) {
    if (!currentUser || !chatId || !messageId) {
        return;
    }

    localStorage.setItem(
        getReadMarkerKey(chatId),
        messageId
    );
}

function getLastReadMessage(chatId) {
    if (!currentUser || !chatId) {
        return "";
    }

    return localStorage.getItem(
        getReadMarkerKey(chatId)
    ) || "";
}


// ==========================================
// UPDATE A CONTACT'S UNREAD BADGE
// ==========================================

function updateContactUnreadBadge(userId, count) {
    document.querySelectorAll(
        ".contact-unread-badge"
    ).forEach(function (badge) {
        if (badge.dataset.userId !== userId) {
            return;
        }

        if (count > 0) {
            badge.textContent =
                count > 9 ? "9+" : String(count);

            badge.classList.add("has-unread");
        } else {
            badge.textContent = "";
            badge.classList.remove("has-unread");
        }
    });
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
        const profilesReference = collection(
            db,
            "publicProfiles"
        );

        const profilesSnapshot = await getDocs(
            profilesReference
        );

        allMembers = [];

        profilesSnapshot.forEach(function (profileDocument) {
            const profileData = profileDocument.data();

            const member = {
                ...profileData,
                id: profileDocument.id
            };

            const memberId = getMemberId(member);

            if (
                !memberId ||
                memberId === currentUser.uid
            ) {
                return;
            }

            allMembers.push(member);
        });

        renderMembers(allMembers);

        // Start listening to each member's online status.
        listenForMemberPresence();

        if (allMembers.length === 0) {
            showStatus(
                "No other users were found. " +
                "Check that publicProfiles documents exist."
            );
        } else {
            hideStatus();
        }

    } catch (error) {
        console.error(
            "LoveBond: Failed to load profiles:",
            error
        );

        contactsList.replaceChildren();

        const errorMessage = document.createElement("div");

        errorMessage.className = "empty-contacts";
        errorMessage.textContent =
            "Unable to load users. Check your Firestore rules.";

        contactsList.appendChild(errorMessage);

        showStatus(
            "Unable to load profiles. Check your Firestore permissions."
        );
    }
}


// ==========================================
// DISPLAY CONTACTS
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
        const online = isMemberOnline(memberId);

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

        const avatar = createAvatar(
            member,
            "contact-avatar"
        );

        const info = document.createElement("div");

        info.className = "contact-info";

        const name = document.createElement("div");

        name.className = "contact-name";
        name.textContent = memberName;

        const preview = document.createElement("div");

        preview.className = "contact-presence";

        const dot = document.createElement("span");

        dot.className = "contact-presence-dot";
        dot.classList.add(online ? "online" : "offline");

        const statusText = document.createElement("span");

        statusText.className = "contact-presence-text";
        statusText.classList.add(
            online ? "online" : "offline"
        );

        statusText.textContent = online
            ? "Online"
            : "Offline";

        preview.append(dot, statusText);
        info.append(name, preview);

        // Unread message badge.
        const unreadBadge = document.createElement("span");

        unreadBadge.className = "contact-unread-badge";
        unreadBadge.dataset.userId = memberId;

        const unreadCount = unreadCounts[memberId] || 0;

        if (unreadCount > 0) {
            unreadBadge.textContent =
                unreadCount > 9
                    ? "9+"
                    : String(unreadCount);

            unreadBadge.classList.add("has-unread");
        }

        contactButton.append(
            avatar,
            info,
            unreadBadge
        );

        contactButton.addEventListener(
            "click",
            function () {
                openConversation(member);
            }
        );

        contactsList.appendChild(contactButton);
    });
}


// ==========================================
// SEARCH CONTACTS
// ==========================================

if (contactSearch) {
    contactSearch.addEventListener(
        "input",
        function () {
            const searchTerm = contactSearch.value
                .trim()
                .toLowerCase();

            const filteredMembers = allMembers.filter(
                function (member) {
                    const name = getMemberName(member)
                        .toLowerCase();

                    const username = String(
                        member.username || ""
                    ).toLowerCase();

                    return (
                        name.includes(searchTerm) ||
                        username.includes(searchTerm)
                    );
                }
            );

            renderMembers(filteredMembers);
        }
    );
}


// ==========================================
// LISTEN FOR UNREAD MESSAGES
// ==========================================

function listenForUnreadMessages() {
    if (!currentUser) {
        return;
    }

    stopUnreadListeners();

    allMembers.forEach(function (member) {
        const otherUserId = getMemberId(member);

        if (
            !otherUserId ||
            otherUserId === currentUser.uid
        ) {
            return;
        }

        const chatId = createChatId(
            currentUser.uid,
            otherUserId
        );

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

        unreadListeners[otherUserId] = onSnapshot(
            messagesQuery,

            function (snapshot) {
                const messages = snapshot.docs;

                if (currentChatId === chatId) {
                    const latestMessage =
                        messages[messages.length - 1];

                    if (latestMessage) {
                        saveLastReadMessage(
                            chatId,
                            latestMessage.id
                        );
                    }

                    unreadCounts[otherUserId] = 0;

                    updateContactUnreadBadge(
                        otherUserId,
                        0
                    );

                    return;
                }

                const lastReadMessageId =
                    getLastReadMessage(chatId);

                let lastReadIndex = -1;

                if (lastReadMessageId) {
                    lastReadIndex = messages.findIndex(
                        function (messageDocument) {
                            return (
                                messageDocument.id ===
                                lastReadMessageId
                            );
                        }
                    );
                }

                let unreadCount = 0;

                messages.forEach(function (
                    messageDocument,
                    index
                ) {
                    const message = messageDocument.data();

                    const receivedMessage =
                        message.senderId === otherUserId &&
                        message.receiverId === currentUser.uid;

                    const afterLastRead =
                        !lastReadMessageId ||
                        lastReadIndex === -1
                            ? true
                            : index > lastReadIndex;

                    if (receivedMessage && afterLastRead) {
                        unreadCount++;
                    }
                });

                unreadCounts[otherUserId] = unreadCount;

                updateContactUnreadBadge(
                    otherUserId,
                    unreadCount
                );
            },

            function (error) {
                console.error(
                    "LoveBond: Unread-message listener failed:",
                    error
                );
            }
        );
    });
}


// ==========================================
// OPEN A CONVERSATION
// ==========================================

async function openConversation(member) {
    if (!currentUser) {
        showStatus("Please sign in to use messages.");
        return;
    }

    const otherUserId = getMemberId(member);

    if (
        !otherUserId ||
        otherUserId === currentUser.uid
    ) {
        return;
    }

    selectedMember = member;

    currentChatId = createChatId(
        currentUser.uid,
        otherUserId
    );

    const chatId = currentChatId;

    stopMessageListener();

    renderMembers(
        contactSearch && contactSearch.value.trim()
            ? allMembers.filter(function (item) {
                const searchTerm = contactSearch.value
                    .trim()
                    .toLowerCase();

                return (
                    getMemberName(item)
                        .toLowerCase()
                        .includes(searchTerm) ||
                    String(item.username || "")
                        .toLowerCase()
                        .includes(searchTerm)
                );
            })
            : allMembers
    );

    chatName.textContent = getMemberName(member);
    chatSubtitle.textContent = "Private conversation";

    updateChatPresence(otherUserId);

    const currentAvatar =
        document.getElementById("chatAvatar");

    if (currentAvatar) {
        const newAvatar = createAvatar(
            member,
            "chat-avatar"
        );

        newAvatar.id = "chatAvatar";

        currentAvatar.replaceWith(newAvatar);
    }

    chatMessages.replaceChildren();

    const loading = document.createElement("div");

    loading.className = "chat-placeholder";
    loading.textContent = "Loading messages...";

    chatMessages.appendChild(loading);

    sendButton.disabled = false;
    messageInput.disabled = false;

    if (
        window.innerWidth <= 700 &&
        messagesLayout
    ) {
        messagesLayout.classList.add("chat-open");
    }

    try {
        const chatReference = doc(
            db,
            "chats",
            chatId
        );

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

        if (currentChatId !== chatId) {
            return;
        }

        listenForMessages(chatId);

    } catch (error) {
        console.error(
            "LoveBond: Unable to open conversation:",
            error
        );

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
    stopMessageListener();

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
                const emptyMessage =
                    document.createElement("div");

                emptyMessage.className = "chat-placeholder";
                emptyMessage.textContent = "No messages yet.";

                chatMessages.appendChild(emptyMessage);

                return;
            }

            snapshot.forEach(function (messageDocument) {
                const message = messageDocument.data();

                renderMessage(message);
            });

            const latestMessage =
                snapshot.docs[snapshot.docs.length - 1];

            if (latestMessage && selectedMember) {
                const otherUserId =
                    getMemberId(selectedMember);

                saveLastReadMessage(
                    chatId,
                    latestMessage.id
                );

                unreadCounts[otherUserId] = 0;

                updateContactUnreadBadge(
                    otherUserId,
                    0
                );
            }

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
// STOP MESSAGE LISTENER
// ==========================================

function stopMessageListener() {
    if (unsubscribeMessages) {
        unsubscribeMessages();

        unsubscribeMessages = null;
    }
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

    textElement.textContent = messageText;

    messageElement.appendChild(textElement);

    const timeElement = document.createElement("span");

    timeElement.className = "message-time";

    timeElement.textContent = formatTimestamp(
        message.createdAt
    );

    messageElement.appendChild(timeElement);

    chatMessages.appendChild(messageElement);
}


// ==========================================
// FORMAT MESSAGE TIME
// ==========================================

function formatTimestamp(timestamp) {
    if (
        !timestamp ||
        typeof timestamp.toDate !== "function"
    ) {
        return "Sending...";
    }

    return timestamp.toDate().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}


// ==========================================
// SCROLL TO LATEST MESSAGE
// ==========================================

function scrollMessagesToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ==========================================
// SEND A TEXT MESSAGE
// ==========================================

messageForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        if (
            !currentUser ||
            !selectedMember ||
            !currentChatId
        ) {
            showStatus(
                "Select a user before sending a message."
            );

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
            showStatus(
                "The selected user's ID could not be found."
            );

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

            if (chatId === currentChatId) {
                messageInput.value = "";
                messageInput.focus();
            }

            hideStatus();

        } catch (error) {
            console.error(
                "LoveBond: Failed to send message:",
                error
            );

            showStatus(
                "Your message could not be sent. " +
                "Check your internet connection and Firestore rules."
            );

        } finally {
            isSending = false;

            sendButton.disabled = !selectedMember;
        }
    }
);


// ==========================================
// STOP ALL UNREAD LISTENERS
// ==========================================

function stopUnreadListeners() {
    Object.keys(unreadListeners).forEach(
        function (userId) {
            unreadListeners[userId]();

            delete unreadListeners[userId];
        }
    );
}


// ==========================================
// LOGOUT
// ==========================================

if (logoutButton) {
    logoutButton.addEventListener(
        "click",
        async function () {
            const confirmLogout = confirm(
                "Are you sure you want to log out of LoveBond?"
            );

            if (!confirmLogout) {
                return;
            }

            logoutButton.disabled = true;
            logoutButton.textContent = "Logging out...";

            try {
                stopMessageListener();
                stopUnreadListeners();
                stopPresenceListeners();

                if (unsubscribeConnection) {
                    unsubscribeConnection();
                    unsubscribeConnection = null;
                }

                // Mark the current user offline before
                // signing out, where the connection permits.
                if (ownPresenceReference) {
                    try {
                        await set(
                            ownPresenceReference,
                            {
                                online: false,
                                lastChanged:
                                    databaseServerTimestamp()
                            }
                        );
                    } catch (presenceError) {
                        console.warn(
                            "LoveBond: Could not update offline status:",
                            presenceError
                        );
                    }
                }

                await signOut(auth);

                window.location.href = "login.html";

            } catch (error) {
                console.error(
                    "LoveBond: Logout failed:",
                    error
                );

                alert(
                    "Unable to log out. Please try again."
                );

                logoutButton.disabled = false;
                logoutButton.textContent = "↪ Logout";
            }
        }
    );
}


// ==========================================
// AUTHENTICATION
// ==========================================

onAuthStateChanged(
    auth,
    async function (user) {
        if (!user) {
            stopMessageListener();
            stopUnreadListeners();
            stopPresenceListeners();

            if (unsubscribeConnection) {
                unsubscribeConnection();
                unsubscribeConnection = null;
            }

            window.location.href = "login.html";

            return;
        }

        currentUser = user;

        addMessagingStyles();

        // Start tracking the current user's connection.
        startOwnPresence();

        await loadMembers();

        // Start unread listeners after members load.
        listenForUnreadMessages();
    }
);


// ==========================================
// INITIALIZE
// ==========================================

messageInput.disabled = true;
sendButton.disabled = true;

console.log(
    "LoveBond: Messaging, unread badges and presence initialized."
);