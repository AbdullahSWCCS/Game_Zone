let currentUser = null;
let currentProfile = null;
let communityGames = [];
let activeGame = null;
let activeSession = null;
let playTimerInterval = null;
let awardedThirtyMinuteMarks = 0;
let avatarImageDraft = "";
let friendRequestCache = [];

document.addEventListener("DOMContentLoaded", function () {
    initializeDashboard();
    setupEventListeners();
    setupFirebaseListeners();
    loadUserData();
    renderTeamGameOptions();
    refreshCommunityGames();
    refreshLeaderboard();
});

window.addEventListener("gamezone:firebase-ready", function () {
    updateFirebaseModeText();
    setupFirebaseListeners();
    refreshCommunityGames();
    refreshLeaderboard();
});

function service() {
    return window.GameZoneFirebase;
}

function initializeDashboard() {
    displayGames("all");
    displayRecommendedGames();
    updateFirebaseModeText();
}

function setupFirebaseListeners() {
    if (!service() || service()._listenerAttached) return;
    service()._listenerAttached = true;
    service().onAuthChanged(async function (user) {
        currentUser = user;
        currentProfile = user ? await service().getUserProfile(user) : null;
        syncProfileToUi();
        updateDailyBonusState();
        refreshLeaderboard();
        refreshFriendRequests();
        refreshTeams();
        if (user) closeAuthGate();
    });
}

function setupEventListeners() {
    document.querySelectorAll(".nav-item").forEach(function (item) {
        item.addEventListener("click", function (e) {
            e.preventDefault();
            document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
            this.classList.add("active");

            if (this.dataset.view) {
                showWorkspace(this.dataset.view);
                return;
            }

            showDashboard();
            displayGames(this.dataset.category || "all");
            updateSectionTitle(this.dataset.category || "all");
        });
    });

    document.getElementById("searchInput").addEventListener("input", function (e) {
        showDashboard();
        filterGames(e.target.value.toLowerCase());
    });

    document.querySelectorAll(".tag-btn").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            document.querySelectorAll(".tag-btn").forEach((tag) => tag.classList.remove("active"));
            this.classList.add("active");
            showDashboard();
            displayGames(this.dataset.category);
            updateSectionTitle(this.dataset.category);
        });
    });

    document.querySelectorAll(".nav-bottom-item").forEach(function (item, index) {
        item.addEventListener("click", function (e) {
            e.preventDefault();
            document.querySelectorAll(".nav-bottom-item").forEach((nav) => nav.classList.remove("active"));
            this.classList.add("active");
            if (index === 0 || index === 1 || index === 2) showDashboard();
            if (index === 3) showWorkspace("friends");
            if (index === 4) showWorkspace("profile");
        });
    });

    document.querySelector(".claim-btn").addEventListener("click", claimDailyBonus);
    document.querySelector(".close-btn").addEventListener("click", closeGameModal);
    document.getElementById("gameModal").addEventListener("click", function (e) {
        if (e.target === this) closeGameModal();
    });
    document.getElementById("publicProfileModal").addEventListener("click", function (e) {
        if (e.target === this) closePublicProfile();
    });
    document.getElementById("levelCompleteBtn").addEventListener("click", markLevelComplete);
    document.getElementById("profileButton").addEventListener("click", function () {
        showWorkspace("profile");
    });
    document.getElementById("authStatus").addEventListener("click", function () {
        showWorkspace("profile");
    });
    document.getElementById("notificationButton").addEventListener("click", function (event) {
        event.stopPropagation();
        toggleNotifications();
    });
    document.getElementById("notificationPanel").addEventListener("click", handleNotificationAction);
    document.getElementById("friendRequestsList").addEventListener("click", handleFriendRequestAction);
    document.getElementById("publicProfileClose").addEventListener("click", closePublicProfile);

    document.getElementById("authForm").addEventListener("submit", handleAuthSubmit);
    document.getElementById("gateAuthForm").addEventListener("submit", handleAuthSubmit);
    document.getElementById("signOutBtn").addEventListener("click", handleSignOut);
    document.getElementById("profileForm").addEventListener("submit", handleProfileSave);
    document.getElementById("profileAvatarFile").addEventListener("change", handleAvatarPreview);
    document.getElementById("uploadForm").addEventListener("submit", handleGameUpload);
    document.getElementById("friendForm").addEventListener("submit", handleFriendRequest);
    document.getElementById("teamForm").addEventListener("submit", handleTeamCreate);

    document.addEventListener("click", function (event) {
        if (!event.target.closest("#notificationPanel") && !event.target.closest("#notificationButton")) {
            hideNotifications();
        }
    });

    document.addEventListener("click", enforceLoginGate, true);

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeGameModal();
            hideNotifications();
            closePublicProfile();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
            e.preventDefault();
            document.getElementById("searchInput").focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "h") {
            e.preventDefault();
            showDashboard();
            displayGames("all");
        }
    });

    document.addEventListener("contextmenu", function (e) {
        const gameCard = e.target.closest(".game-card");
        if (gameCard) {
            e.preventDefault();
            showNotification(`Game: ${gameCard.querySelector(".game-title").textContent}`);
        }
    });
}

function enforceLoginGate(event) {
    if (currentUser) return;
    const allowed = event.target.closest("#authGateModal, #publicProfileModal, #profileSection, #authStatus, #profileButton");
    if (allowed) return;
    event.preventDefault();
    event.stopPropagation();
    openAuthGate();
}

function openAuthGate() {
    const modal = document.getElementById("authGateModal");
    if (!modal) return;
    modal.style.display = "flex";
    document.getElementById("gateAuthEmail").focus();
}

function closeAuthGate() {
    const modal = document.getElementById("authGateModal");
    if (modal) modal.style.display = "none";
}

function showDashboard() {
    document.querySelectorAll(".workspace-section").forEach((section) => {
        section.style.display = "none";
    });
    document.querySelectorAll(".dashboard-view").forEach((section) => {
        section.style.display = "";
    });
}

function showWorkspace(view) {
    document.querySelectorAll(".dashboard-view").forEach((section) => {
        section.style.display = "none";
    });
    document.querySelectorAll(".workspace-section").forEach((section) => {
        section.style.display = "none";
    });
    const section = document.getElementById(`${view}Section`);
    if (section) section.style.display = "";
    if (view === "uploads") refreshCommunityGames();
    if (view === "friends") refreshFriendRequests();
    if (view === "teams") refreshTeams();
    if (view === "profile") syncProfileToUi();
}

function getCatalogGames() {
    const uploaded = communityGames.map((game) => ({
        name: game.title || "Uploaded Game",
        category: game.category || "arcade",
        emoji: game.playType === "team" ? "TM" : "UP",
        link: game.playUrl || game.codeUrl || "",
        upload: game
    }));
    return [...allGames, ...uploaded];
}

function displayGames(category) {
    const gamesGrid = document.getElementById("gamesGrid");
    gamesGrid.innerHTML = "";

    let filteredGames = getCatalogGames();
    if (category === "popular") {
        filteredGames = filteredGames.filter((game) => popularGames.includes(game.name));
    } else if (category === "favorites") {
        filteredGames = JSON.parse(localStorage.getItem("favorites") || "[]");
    } else if (category === "achievements") {
        renderAchievements(gamesGrid);
        return;
    } else if (category !== "all" && category !== "offline") {
        filteredGames = filteredGames.filter((game) => game.category === category);
    }

    filteredGames.sort((a, b) => a.name.localeCompare(b.name));
    filteredGames.forEach((game) => gamesGrid.appendChild(createGameCard(game)));
    animateCards(gamesGrid);
}

function displayRecommendedGames() {
    const recommendedGrid = document.getElementById("recommendedGrid");
    recommendedGrid.innerHTML = "";
    allGames
        .filter((game) => recommendedGames.includes(game.name))
        .forEach((game) => {
            const card = createGameCard(game);
            card.classList.add("recommended-card");
            recommendedGrid.appendChild(card);
        });
}

function createGameCard(game) {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
        <div class="game-image">${escapeHtml(game.emoji || "GZ")}</div>
        <div class="game-info">
            <div class="game-title">${escapeHtml(game.name)}</div>
            <div class="game-rating">
                <span class="star">★</span>
                <span class="star">★</span>
                <span class="star">★</span>
                <span class="star">★</span>
                <span class="star empty">★</span>
            </div>
        </div>
    `;
    card.addEventListener("click", () => openGame(game));
    card.addEventListener("dblclick", () => addToFavorites(game));
    card.addEventListener("mouseenter", function () {
        this.style.transform = "scale(1.05) translateY(-10px)";
    });
    card.addEventListener("mouseleave", function () {
        this.style.transform = "scale(1) translateY(0)";
    });
    return card;
}

function filterGames(searchTerm) {
    const gamesGrid = document.getElementById("gamesGrid");
    gamesGrid.innerHTML = "";
    const filtered = getCatalogGames().filter((game) =>
        game.name.toLowerCase().includes(searchTerm)
        || game.category.toLowerCase().includes(searchTerm)
    );
    if (!filtered.length) {
        gamesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #a0a9c3; padding: 40px;">No games found. Try a different search.</p>';
        return;
    }
    filtered.forEach((game) => gamesGrid.appendChild(createGameCard(game)));
}

function openGame(game) {
    if (!currentUser) {
        openAuthGate();
        return;
    }
    if (isAdminGame(game) && !isCurrentAdmin()) {
        showWorkspace("profile");
        showNotification("Admin dashboard needs the separate admin login.");
        return;
    }
    if (!game.link) {
        showNotification("This uploaded game has no playable browser URL yet.");
        return;
    }

    activeGame = game;
    activeSession = {
        gameName: game.name,
        category: game.category,
        startedAt: Date.now()
    };
    awardedThirtyMinuteMarks = 0;

    document.getElementById("activeGameTitle").textContent = game.name;
    document.getElementById("gameFrame").src = game.link;
    document.getElementById("gameModal").style.display = "flex";
    document.getElementById("levelCompleteBtn").style.display = "";
    document.getElementById("levelCompleteBtn").disabled = false;
    document.body.style.overflow = "hidden";
    recordGamePlay(game.name);
    startPlayTimer();
}

function isAdminGame(game) {
    return /admin/i.test(game.name || "") || /admin-dashboard/i.test(game.link || "");
}

function isCurrentAdmin() {
    return currentProfile?.role === "admin" || currentUser?.role === "admin";
}

async function closeGameModal() {
    const modal = document.getElementById("gameModal");
    if (modal.style.display === "none") return;

    const endedAt = Date.now();
    const durationSeconds = activeSession ? Math.max(0, Math.floor((endedAt - activeSession.startedAt) / 1000)) : 0;
    stopPlayTimer();

    document.getElementById("gameFrame").src = "";
    modal.style.display = "none";
    document.body.style.overflow = "auto";

    if (activeSession && service()) {
        const profile = await service().recordPlaySession({
            ...activeSession,
            endedAt,
            durationSeconds
        });
        currentProfile = profile || currentProfile;
        syncProfileToUi();
    }

    activeGame = null;
    activeSession = null;
}

function startPlayTimer() {
    stopPlayTimer();
    updatePlayTimer();
    playTimerInterval = setInterval(updatePlayTimer, 1000);
}

function stopPlayTimer() {
    if (playTimerInterval) clearInterval(playTimerInterval);
    playTimerInterval = null;
}

async function updatePlayTimer() {
    if (!activeSession) return;
    const elapsed = Math.floor((Date.now() - activeSession.startedAt) / 1000);
    document.getElementById("playTimer").textContent = formatDuration(elapsed);
    const thirtyMinuteMark = Math.floor(elapsed / 1800);
    if (thirtyMinuteMark > awardedThirtyMinuteMarks && service()) {
        awardedThirtyMinuteMarks = thirtyMinuteMark;
        currentProfile = await service().awardPoints("30-minute-play", 100, {
            gameName: activeSession.gameName,
            elapsedSeconds: elapsed
        });
        syncProfileToUi();
        showNotification("+100 points for 30 minutes of play.");
    }
}

async function markLevelComplete() {
    if (!activeGame || !service()) return;
    const button = document.getElementById("levelCompleteBtn");
    button.disabled = true;
    currentProfile = await service().awardPoints("level-complete", 150, {
        gameName: activeGame.name,
        completedAt: Date.now()
    });
    syncProfileToUi();
    button.style.display = "none";
    showNotification("+150 points for level complete.");
}

async function claimDailyBonus() {
    if (!currentUser) {
        openAuthGate();
        return;
    }
    try {
        const result = await service().claimDailyBonus();
        currentProfile = result.profile || currentProfile;
        syncProfileToUi();
        updateDailyBonusState();
        showNotification(result.message);
    } catch (error) {
        showNotification(error.message || "Bonus claim failed.");
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!service()) return;
    const action = event.submitter?.dataset.authAction || "signin";
    const isGateForm = event.currentTarget.id === "gateAuthForm";
    const email = document.getElementById(isGateForm ? "gateAuthEmail" : "authEmail").value.trim();
    const password = document.getElementById(isGateForm ? "gateAuthPassword" : "authPassword").value;
    const nameField = document.getElementById(isGateForm ? "gateAuthName" : "authName");
    const displayName = nameField.value.trim() || email.split("@")[0];
    try {
        if (action === "signup") {
            await service().signUp(email, password, displayName);
            showNotification("Account created.");
        } else {
            await service().signIn(email, password);
            showNotification("Signed in.");
        }
        event.currentTarget.reset();
        closeAuthGate();
    } catch (error) {
        showNotification(error.message || "Auth failed.");
    }
}

async function handleSignOut() {
    if (!service()) return;
    await service().signOut();
    currentUser = null;
    currentProfile = null;
    friendRequestCache = [];
    renderNotificationList([]);
    syncProfileToUi();
    showNotification("Signed out.");
}

async function handleProfileSave() {
    if (!service()) return;
    await service().signOut();
    currentUser = null;
    currentProfile = null;
    friendRequestCache = [];
    renderNotificationList([]);
    syncProfileToUi();
    showNotification("Signed out.");
}

async function handleProfileSave(event) {
    event.preventDefault();
    if (!service()) return;
    try {
        const displayName = document.getElementById("profileDisplayName").value.trim();
        currentProfile = await service().saveUserProfile({
            displayName,
            username: document.getElementById("profileUsername").value.trim(),
            country: document.getElementById("profileCountry").value.trim(),
            bio: document.getElementById("profileBio").value.trim(),
            avatar: (displayName || "GZ").slice(0, 2).toUpperCase(),
            avatarImage: avatarImageDraft || currentProfile?.avatarImage || ""
        });
        avatarImageDraft = currentProfile.avatarImage || "";
        syncProfileToUi();
        showNotification("Profile saved.");
    } catch (error) {
        showNotification(error.message || "Login required.");
    }
}

function handleAvatarPreview(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        showNotification("Please choose an image file.");
        return;
    }
    if (file.size > 700 * 1024) {
        showNotification("Profile image should be under 700KB.");
        event.target.value = "";
        return;
    }
    const reader = new FileReader();
    reader.onload = function () {
        avatarImageDraft = String(reader.result || "");
        renderProfileAvatar({ ...(currentProfile || {}), avatarImage: avatarImageDraft });
    };
    reader.readAsDataURL(file);
}

async function handleGameUpload(event) {
    event.preventDefault();
    if (!service()) return;
    const submitButton = event.submitter || event.target.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Uploading...";
    try {
        const game = await service().uploadGame({
            title: document.getElementById("gameTitle").value.trim(),
            category: document.getElementById("gameCategory").value,
            playType: document.getElementById("gamePlayType").value,
            playUrl: document.getElementById("gamePlayUrl").value.trim(),
            description: document.getElementById("gameDescription").value.trim(),
            codeFile: document.getElementById("gameCodeFile").files[0],
            exeFile: document.getElementById("gameExeFile").files[0],
            thumbnailFile: document.getElementById("gameThumbnailFile").files[0]
        });
        event.target.reset();
        showNotification(`${game.title} uploaded.`);
        await refreshCommunityGames();
        displayGames("all");
    } catch (error) {
        showNotification(error.message || "Upload failed.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Upload game";
    }
}

async function handleFriendRequest(event) {
    event.preventDefault();
    if (!service()) return;
    try {
        await service().sendFriendRequest(document.getElementById("friendIdentifier").value);
        event.target.reset();
        showNotification("Friend request saved.");
        refreshFriendRequests();
    } catch (error) {
        showNotification(error.message || "Request failed.");
    }
}

async function handleTeamCreate(event) {
    event.preventDefault();
    if (!service()) return;
    try {
        await service().createTeam(
            document.getElementById("teamName").value.trim(),
            document.getElementById("teamGame").value
        );
        event.target.reset();
        showNotification("Team created.");
        refreshTeams();
    } catch (error) {
        showNotification(error.message || "Team create failed.");
    }
}

async function refreshCommunityGames() {
    if (!service()) return;
    communityGames = await service().listUploadedGames();
    renderUploadedGames();
}

function renderUploadedGames() {
    const list = document.getElementById("uploadedGamesList");
    if (!list) return;
    if (!communityGames.length) {
        list.innerHTML = '<p class="helper-text">No uploaded games yet.</p>';
        return;
    }
    list.innerHTML = communityGames.map((game) => `
        <div class="uploaded-game">
            <h4>${escapeHtml(game.title || "Uploaded Game")}</h4>
            <p>${escapeHtml(game.category || "arcade")} / ${escapeHtml(game.playType || "single")}</p>
            <p>${escapeHtml(game.description || "No description")}</p>
            ${game.playUrl ? `<button type="button" onclick="openGame({name: '${escapeJs(game.title)}', category: '${escapeJs(game.category || "arcade")}', link: '${escapeJs(game.playUrl)}', emoji: 'UP'})">Play</button>` : '<p>Stored, but no playable URL yet.</p>'}
        </div>
    `).join("");
}

async function refreshFriendRequests() {
    const list = document.getElementById("friendRequestsList");
    if (!list || !service()) return;
    const requests = await service().listFriendRequests();
    friendRequestCache = requests;
    renderNotificationList(requests);
    if (!requests.length) {
        list.innerHTML = '<p class="helper-text">No requests yet.</p>';
        return;
    }
    list.innerHTML = requests.map((request) => `
        <div class="simple-list-item friend-request-item">
            <strong>${escapeHtml(request.direction === "incoming" ? (request.fromName || "Player") : (request.toName || request.toIdentifier || "Player"))}</strong>
            <p>${request.direction === "incoming" ? "Sent you a request" : "Request sent"} / Status: ${escapeHtml(request.status || "pending")}</p>
            <div class="inline-actions">
                <button type="button" class="secondary-action" data-profile-uid="${escapeHtml(request.direction === "incoming" ? request.fromUid : request.toUid)}">View profile</button>
                ${request.direction === "incoming" && request.status === "pending" ? `
                    <button type="button" data-request-id="${escapeHtml(request.id)}" data-request-action="accepted">Accept</button>
                    <button type="button" class="secondary-action" data-request-id="${escapeHtml(request.id)}" data-request-action="rejected">Reject</button>
                ` : ""}
            </div>
        </div>
    `).join("");
}

async function handleFriendRequestAction(event) {
    const profileButton = event.target.closest("[data-profile-uid]");
    if (profileButton) {
        await showPublicProfile(profileButton.dataset.profileUid);
        return;
    }
    const actionButton = event.target.closest("[data-request-action]");
    if (!actionButton) return;
    await respondToFriendRequest(actionButton.dataset.requestId, actionButton.dataset.requestAction);
}

async function handleNotificationAction(event) {
    await handleFriendRequestAction(event);
}

async function respondToFriendRequest(requestId, status) {
    try {
        await service().respondToFriendRequest(requestId, status);
        showNotification(status === "accepted" ? "Friend request accepted." : "Friend request rejected.");
        await refreshFriendRequests();
    } catch (error) {
        showNotification(error.message || "Could not update request.");
    }
}

async function showPublicProfile(uid) {
    const profile = await service().getPublicProfile(uid);
    if (!profile) {
        showNotification("Profile not found.");
        return;
    }
    const name = profile.displayName || profile.username || "Player";
    const details = [
        profile.username ? `@${profile.username}` : "",
        profile.country || "",
        `${Number(profile.points || 0).toLocaleString()} points`
    ].filter(Boolean).join(" / ");
    const modal = document.getElementById("publicProfileModal");
    document.getElementById("publicProfileName").textContent = name;
    document.getElementById("publicProfileMeta").textContent = details;
    document.getElementById("publicProfileBio").textContent = profile.bio || "No bio added yet.";
    const avatar = document.getElementById("publicProfileAvatar");
    avatar.innerHTML = profile.avatarImage
        ? `<img src="${escapeHtml(profile.avatarImage)}" alt="">`
        : escapeHtml(profile.avatar || name.slice(0, 2).toUpperCase());
    modal.style.display = "flex";
}

function closePublicProfile() {
    const modal = document.getElementById("publicProfileModal");
    if (modal) modal.style.display = "none";
}

function toggleNotifications() {
    const panel = document.getElementById("notificationPanel");
    if (!panel) return;
    if (panel.style.display === "none") {
        panel.style.display = "block";
        renderNotificationList(friendRequestCache);
    } else {
        hideNotifications();
    }
}

function hideNotifications() {
    const panel = document.getElementById("notificationPanel");
    if (panel) panel.style.display = "none";
}

function renderNotificationList(requests = []) {
    const list = document.getElementById("notificationList");
    const badge = document.getElementById("notificationBadge");
    if (!list || !badge) return;
    const incomingPending = requests.filter((request) => request.direction === "incoming" && request.status === "pending");
    badge.textContent = incomingPending.length;
    badge.style.display = incomingPending.length ? "flex" : "none";
    if (!requests.length) {
        list.innerHTML = '<p class="helper-text">No notifications yet.</p>';
        return;
    }
    list.innerHTML = requests.slice(0, 8).map((request) => {
        const otherName = request.direction === "incoming"
            ? (request.fromName || "Player")
            : (request.toName || request.toIdentifier || "Player");
        return `
            <div class="simple-list-item notification-row">
                <strong>${escapeHtml(otherName)}</strong>
                <p>${request.direction === "incoming" ? "Friend request received" : "Friend request sent"} / ${escapeHtml(request.status || "pending")}</p>
                <div class="inline-actions">
                    <button type="button" class="secondary-action" data-profile-uid="${escapeHtml(request.direction === "incoming" ? request.fromUid : request.toUid)}">Profile</button>
                    ${request.direction === "incoming" && request.status === "pending" ? `
                        <button type="button" data-request-id="${escapeHtml(request.id)}" data-request-action="accepted">Accept</button>
                        <button type="button" class="secondary-action" data-request-id="${escapeHtml(request.id)}" data-request-action="rejected">Reject</button>
                    ` : ""}
                </div>
            </div>
        `;
    }).join("");
}

async function refreshTeams() {
    const list = document.getElementById("teamsList");
    if (!list || !service()) return;
    const teams = await service().listTeams();
    if (!teams.length) {
        list.innerHTML = '<p class="helper-text">No teams yet.</p>';
        return;
    }
    list.innerHTML = teams.map((team) => `
        <div class="simple-list-item">
            <strong>${escapeHtml(team.name)}</strong>
            <p>Game: ${escapeHtml(team.gameName || "Any game")}</p>
            <p>Members: ${(team.memberNames || []).map(escapeHtml).join(", ") || "1"}</p>
        </div>
    `).join("");
}

function renderTeamGameOptions() {
    const select = document.getElementById("teamGame");
    if (!select) return;
    select.innerHTML = allGames
        .filter((game) => ["action", "arcade", "sports", "strategy"].includes(game.category))
        .map((game) => `<option value="${escapeHtml(game.name)}">${escapeHtml(game.name)}</option>`)
        .join("");
}

async function refreshLeaderboard() {
    if (!service()) return;
    const leaderboard = document.getElementById("leaderboard");
    const rows = await service().listLeaderboard();
    if (!rows.length) return;
    leaderboard.innerHTML = rows.map((row, index) => `
        <div class="leaderboard-item">
            <span class="rank">${index + 1}</span>
            <span class="name">${escapeHtml(row.displayName || row.username || "Player")}</span>
            <span class="score">${Number(row.points || 0).toLocaleString()}</span>
        </div>
    `).join("");
}

function syncProfileToUi() {
    updateFirebaseModeText();
    const profile = currentProfile || {};
    const authStatus = document.getElementById("authStatus");
    authStatus.textContent = currentUser ? (profile.displayName || currentUser.displayName || "Player") : "Sign in";
    authStatus.classList.toggle("online", Boolean(currentUser));

    if (profile.points !== undefined) document.getElementById("points").textContent = profile.points;
    if (profile.coins !== undefined) document.getElementById("coins").textContent = profile.coins;

    document.getElementById("authForm").closest(".workspace-card").style.display = currentUser ? "none" : "";
    document.getElementById("signOutBtn").style.display = currentUser ? "" : "none";

    document.getElementById("profileDisplayName").value = profile.displayName || "";
    document.getElementById("profileUsername").value = profile.username || "";
    document.getElementById("profileCountry").value = profile.country || "";
    document.getElementById("profileBio").value = profile.bio || "";
    avatarImageDraft = profile.avatarImage || "";
    renderProfileAvatar(profile);

    const stats = document.getElementById("profileStats");
    if (stats) {
        stats.innerHTML = [
            ["Points", profile.points || document.getElementById("points").textContent || 0],
            ["Level", profile.level || 1],
            ["Coins", profile.coins || document.getElementById("coins").textContent || 0],
            ["Games", profile.gamesPlayed || 0],
            ["Minutes", profile.minutesPlayed || 0],
            ["Last game", profile.lastPlayedGame || "-"],
            ["Role", profile.role || "user"]
        ].map(([label, value]) => `
            <div class="stat-tile">
                <strong>${escapeHtml(String(value))}</strong>
                <span>${escapeHtml(label)}</span>
            </div>
        `).join("");
    }
    updateDailyBonusState();
}

function renderProfileAvatar(profile = {}) {
    const preview = document.getElementById("profilePreview");
    const profileButton = document.getElementById("profileButton");
    const avatarText = profile.avatar || (profile.displayName || "GZ").slice(0, 2).toUpperCase();
    const image = profile.avatarImage || "";
    const html = image ? `<img src="${escapeHtml(image)}" alt="">` : escapeHtml(avatarText);
    if (preview) preview.innerHTML = html;
    if (profileButton) profileButton.innerHTML = html;
}

function updateDailyBonusState() {
    const button = document.querySelector(".claim-btn");
    const text = document.querySelector(".bonus-text");
    if (!button || !text) return;
    if (!currentUser) {
        button.disabled = false;
        text.textContent = "Login to claim your reward.";
        return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const claimed = currentProfile?.lastDailyBonusDate === today;
    button.disabled = claimed;
    text.textContent = claimed ? "Already claimed today." : "Claim your reward!";
}

function updateFirebaseModeText() {
    const modeText = document.getElementById("firebaseModeText");
    if (modeText && service()) {
        modeText.textContent = service().configured
            ? "Firebase connected: Auth, Firestore, and Storage are active."
            : "Local demo mode: paste config in firebase-config.js to use Firebase.";
    }
}

function updateSectionTitle(category) {
    const titles = {
        all: "Popular Games",
        puzzle: "Puzzle Games",
        action: "Action Games",
        arcade: "Arcade Games",
        strategy: "Strategy Games",
        racing: "Racing Games",
        sports: "Sports Games",
        music: "Music Games",
        tools: "Tools & Utilities",
        utility: "Utility Apps",
        favorites: "Favorite Games",
        achievements: "Achievements",
        popular: "Popular Games",
        offline: "Offline Games"
    };
    document.getElementById("sectionTitle").textContent = titles[category] || "Popular Games";
}

function renderAchievements(container) {
    const plays = JSON.parse(localStorage.getItem("gamePlays") || "{}");
    const totalPlays = Object.values(plays).reduce((a, b) => a + b, 0);
    const achievements = [
        ["First Game", totalPlays >= 1],
        ["Casual Gamer", totalPlays >= 10],
        ["Gaming Enthusiast", totalPlays >= 50],
        ["Legend Gamer", totalPlays >= 100]
    ];
    container.innerHTML = achievements.map(([name, unlocked]) => `
        <div class="workspace-card">
            <h3>${escapeHtml(name)}</h3>
            <p class="helper-text">${unlocked ? "Unlocked" : "Locked"}</p>
        </div>
    `).join("");
}

function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification-toast";
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: #a855f7;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        z-index: 3000;
        animation: slideInRight 0.3s ease-out;
        max-width: min(380px, calc(100vw - 40px));
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = "slideOutRight 0.3s ease-out";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function recordGamePlay(gameName) {
    const gamePlays = JSON.parse(localStorage.getItem("gamePlays") || "{}");
    gamePlays[gameName] = (gamePlays[gameName] || 0) + 1;
    localStorage.setItem("gamePlays", JSON.stringify(gamePlays));
}

function addToFavorites(game) {
    const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
    if (!favorites.find((item) => item.name === game.name)) {
        favorites.push(game);
        localStorage.setItem("favorites", JSON.stringify(favorites));
        showNotification("Added to favorites.");
    }
}

function loadUserData() {
    const savedPoints = localStorage.getItem("userPoints");
    const savedCoins = localStorage.getItem("userCoins");
    if (savedPoints) document.getElementById("points").textContent = savedPoints;
    if (savedCoins) document.getElementById("coins").textContent = savedCoins;
    if (!savedCoins) localStorage.setItem("userCoins", "1250");

    const coinsElement = document.getElementById("coins");
    const observer = new MutationObserver(() => {
        localStorage.setItem("userCoins", coinsElement.textContent);
    });
    observer.observe(coinsElement, { childList: true, characterData: true });
}

function animateCards(container) {
    setTimeout(() => {
        container.querySelectorAll(".game-card").forEach((card, index) => {
            card.style.animation = `fadeInUp 0.5s ease-out ${index * 0.03}s forwards`;
            card.style.opacity = "0";
        });
    }, 0);
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[char]));
}

function escapeJs(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const style = document.createElement("style");
style.textContent = `
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

console.log("Game Zone dashboard with Firebase-ready systems loaded.");
