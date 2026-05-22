(function () {
    const config = window.GAMEZONE_FIREBASE_CONFIG || {};
    const hasFirebaseConfig = Boolean(
        config.apiKey
        && !String(config.apiKey).includes("PASTE_")
        && config.projectId
        && !String(config.appId || "").includes("PASTE_")
    );

    let mode = "local";
    let auth = null;
    let db = null;
    let storage = null;
    let currentUser = null;
    const authListeners = [];
    const adminEmail = normalizeEmail(window.GAMEZONE_ADMIN_EMAIL || "admin@gamezone.local");
    const adminPassword = String(window.GAMEZONE_ADMIN_PASSWORD || "admin12345");

    function uid() {
        return `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    function read(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
        } catch {
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        return value;
    }

    function localUser() {
        return read("gamezoneLocalUser", null);
    }

    function normalizeEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function localAccounts() {
        return read("gamezoneLocalAccounts", {});
    }

    function saveLocalAccount(account) {
        const accounts = localAccounts();
        accounts[normalizeEmail(account.email)] = account;
        write("gamezoneLocalAccounts", accounts);
        return account;
    }

    function setLocalUser(user) {
        currentUser = write("gamezoneLocalUser", user);
        authListeners.forEach((listener) => listener(currentUser));
        return currentUser;
    }

    function userPublicData(user, extra) {
        return {
            uid: user.uid,
            email: user.email || "",
            emailLower: (user.email || "").toLowerCase(),
            displayName: extra?.displayName || user.displayName || "GameZone Player",
            username: extra?.username || (user.email || "player").split("@")[0],
            bio: extra?.bio || "",
            country: extra?.country || "",
            avatar: extra?.avatar || "GZ",
            avatarImage: extra?.avatarImage || "",
            role: extra?.role || "user",
            points: extra?.points || 0,
            coins: extra?.coins || 1250,
            level: extra?.level || 1,
            gamesPlayed: extra?.gamesPlayed || 0,
            minutesPlayed: extra?.minutesPlayed || 0,
            lastDailyBonusDate: extra?.lastDailyBonusDate || "",
            updatedAt: Date.now(),
            createdAt: extra?.createdAt || Date.now(),
            searchKeys: [
                (user.email || "").toLowerCase(),
                (extra?.username || (user.email || "player").split("@")[0]).toLowerCase()
            ].filter(Boolean)
        };
    }

    async function tryFirebaseInit() {
        if (!hasFirebaseConfig || !window.firebase) return;
        try {
            firebase.initializeApp(config);
            auth = firebase.auth();
            db = firebase.firestore();
            storage = firebase.storage();
            mode = "firebase";
            auth.onAuthStateChanged(async (user) => {
                currentUser = user;
                if (user) {
                    await ensureUserProfile(user);
                }
                authListeners.forEach((listener) => listener(user));
            });
        } catch (error) {
            console.warn("Firebase disabled, using local mode:", error);
            mode = "local";
        }
    }

    async function ensureUserProfile(user, extra = {}) {
        if (mode !== "firebase") return userPublicData(user, extra);
        const ref = db.collection("users").doc(user.uid);
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set(userPublicData(user, extra), { merge: true });
        } else {
            await ref.set({
                email: user.email || "",
                emailLower: (user.email || "").toLowerCase(),
                lastSeenAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        return (await ref.get()).data();
    }

    async function signUp(email, password, displayName) {
        const cleanEmail = normalizeEmail(email);
        if (mode === "firebase") {
            const credential = await auth.createUserWithEmailAndPassword(cleanEmail, password);
            await credential.user.updateProfile({ displayName });
            await ensureUserProfile(credential.user, { displayName });
            return credential.user;
        }
        const accounts = localAccounts();
        if (accounts[cleanEmail]) throw new Error("Account already exists. Please sign in.");
        const account = saveLocalAccount({
            uid: uid(),
            email: cleanEmail,
            displayName,
            password,
            role: "user",
            isLocal: true
        });
        await getUserProfile(account);
        return setLocalUser(account);
    }

    async function signIn(email, password) {
        const cleanEmail = normalizeEmail(email);
        if (mode === "firebase") {
            return (await auth.signInWithEmailAndPassword(cleanEmail, password)).user;
        }
        const accounts = localAccounts();
        const saved = accounts[cleanEmail];
        if (saved) {
            if (saved.password && saved.password !== password) throw new Error("Wrong password");
            return setLocalUser(saved);
        }
        const account = saveLocalAccount({
            uid: uid(),
            email: cleanEmail,
            displayName: cleanEmail.split("@")[0],
            password,
            role: "user",
            isLocal: true
        });
        await getUserProfile(account);
        return setLocalUser(account);
    }

    async function signInAdmin(email, password) {
        const cleanEmail = normalizeEmail(email);
        if (mode !== "firebase" && cleanEmail === adminEmail && password === adminPassword) {
            const accounts = localAccounts();
            const account = saveLocalAccount({
                ...(accounts[cleanEmail] || {}),
                uid: accounts[cleanEmail]?.uid || uid(),
                email: cleanEmail,
                displayName: accounts[cleanEmail]?.displayName || "GameZone Admin",
                password,
                role: "admin",
                isLocal: true
            });
            setLocalUser(account);
            const profiles = read("gamezoneProfiles", {});
            profiles[account.uid] = {
                ...(profiles[account.uid] || userPublicData(account, { displayName: account.displayName })),
                displayName: account.displayName,
                role: "admin",
                updatedAt: Date.now()
            };
            write("gamezoneProfiles", profiles);
            return account;
        }
        const user = await signIn(email, password);
        const profile = await getUserProfile(user);
        const isFirebaseAdmin = mode === "firebase" && profile?.role === "admin";
        if (!isFirebaseAdmin) {
            await signOutUser();
            throw new Error("This account is not an admin.");
        }
        return user;
    }

    async function signOutUser() {
        if (mode === "firebase") {
            await auth.signOut();
            return;
        }
        localStorage.removeItem("gamezoneLocalUser");
        currentUser = null;
        authListeners.forEach((listener) => listener(null));
    }

    async function getUserProfile(user = currentUser) {
        if (!user) return null;
        if (mode === "firebase") {
            const snap = await db.collection("users").doc(user.uid).get();
            return snap.exists ? snap.data() : ensureUserProfile(user);
        }
        const profiles = read("gamezoneProfiles", {});
        const profile = profiles[user.uid] || userPublicData(user, {});
        profiles[user.uid] = profile;
        write("gamezoneProfiles", profiles);
        return profile;
    }

    async function saveUserProfile(profile) {
        const user = currentUser || localUser();
        if (!user) throw new Error("Login required");
        const cleanProfile = {
            displayName: profile.displayName || "GameZone Player",
            username: profile.username || "player",
            bio: profile.bio || "",
            country: profile.country || "",
            avatar: profile.avatar || "GZ",
            avatarImage: profile.avatarImage || "",
            updatedAt: Date.now(),
            searchKeys: [
                (user.email || "").toLowerCase(),
                (profile.username || "").toLowerCase()
            ].filter(Boolean)
        };
        if (mode === "firebase") {
            if (auth?.currentUser && cleanProfile.displayName) {
                await auth.currentUser.updateProfile({ displayName: cleanProfile.displayName });
            }
            await db.collection("users").doc(user.uid).set(cleanProfile, { merge: true });
            return getUserProfile(user);
        }
        const profiles = read("gamezoneProfiles", {});
        profiles[user.uid] = { ...(profiles[user.uid] || userPublicData(user, {})), ...cleanProfile };
        write("gamezoneProfiles", profiles);
        saveLocalAccount({ ...user, displayName: cleanProfile.displayName });
        setLocalUser({ ...user, displayName: cleanProfile.displayName });
        return profiles[user.uid];
    }

    async function awardPoints(reason, points, meta = {}) {
        const user = currentUser || localUser();
        if (!user) return null;
        const profile = await getUserProfile(user);
        const nextPoints = Math.max(0, Number(profile.points || 0) + Number(points || 0));
        const nextLevel = Math.floor(nextPoints / 1000) + 1;
        const coinBonus = nextLevel > Number(profile.level || 1) ? 250 : 0;
        const update = {
            points: nextPoints,
            level: nextLevel,
            coins: Number(profile.coins || 0) + coinBonus,
            updatedAt: Date.now()
        };

        if (mode === "firebase") {
            const batch = db.batch();
            const userRef = db.collection("users").doc(user.uid);
            const ledgerRef = db.collection("pointsLedger").doc();
            batch.set(userRef, update, { merge: true });
            batch.set(ledgerRef, {
                uid: user.uid,
                reason,
                points,
                meta,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
        } else {
            const profiles = read("gamezoneProfiles", {});
            profiles[user.uid] = { ...profile, ...update };
            write("gamezoneProfiles", profiles);
            const ledger = read("gamezonePointsLedger", []);
            ledger.push({ id: uid(), uid: user.uid, reason, points, meta, createdAt: Date.now() });
            write("gamezonePointsLedger", ledger);
        }
        return getUserProfile(user);
    }

    async function claimDailyBonus() {
        const user = currentUser || localUser();
        if (!user) throw new Error("Login required");
        const today = new Date().toISOString().slice(0, 10);
        const profile = await getUserProfile(user);
        if (profile.lastDailyBonusDate === today) {
            return { profile, claimed: false, message: "Daily bonus already claimed today." };
        }
        const nextPoints = Number(profile.points || 0) + 25;
        const nextLevel = Math.floor(nextPoints / 1000) + 1;
        const levelCoins = nextLevel > Number(profile.level || 1) ? 250 : 0;
        const update = {
            points: nextPoints,
            level: nextLevel,
            coins: Number(profile.coins || 0) + 100 + levelCoins,
            lastDailyBonusDate: today,
            updatedAt: Date.now()
        };
        if (mode === "firebase") {
            const batch = db.batch();
            const userRef = db.collection("users").doc(user.uid);
            const ledgerRef = db.collection("pointsLedger").doc();
            batch.set(userRef, update, { merge: true });
            batch.set(ledgerRef, {
                uid: user.uid,
                reason: "daily-bonus",
                points: 25,
                meta: { coins: 100, date: today },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
        } else {
            const profiles = read("gamezoneProfiles", {});
            profiles[user.uid] = { ...profile, ...update };
            write("gamezoneProfiles", profiles);
            const ledger = read("gamezonePointsLedger", []);
            ledger.push({ id: uid(), uid: user.uid, reason: "daily-bonus", points: 25, meta: { coins: 100, date: today }, createdAt: Date.now() });
            write("gamezonePointsLedger", ledger);
        }
        return { profile: await getUserProfile(user), claimed: true, message: "Bonus claimed: +100 coins and +25 points." };
    }

    async function getPublicProfile(uidValue) {
        if (!uidValue) return null;
        if (mode === "firebase") {
            const snap = await db.collection("users").doc(uidValue).get();
            return snap.exists ? snap.data() : null;
        }
        return read("gamezoneProfiles", {})[uidValue] || null;
    }

    async function findUserByIdentifier(identifier) {
        const search = String(identifier || "").trim().toLowerCase();
        if (!search) return null;
        if (mode === "firebase") {
            const users = await db.collection("users").where("searchKeys", "array-contains", search).limit(1).get();
            if (users.empty) return null;
            const doc = users.docs[0];
            return { uid: doc.id, ...doc.data() };
        }
        const profiles = Object.values(read("gamezoneProfiles", {}));
        return profiles.find((profile) => (profile.searchKeys || []).includes(search)) || null;
    }

    async function recordPlaySession(session) {
        const user = currentUser || localUser();
        if (!user) return null;
        const profile = await getUserProfile(user);
        const durationMinutes = Math.floor((session.durationSeconds || 0) / 60);
        const update = {
            gamesPlayed: Number(profile.gamesPlayed || 0) + 1,
            minutesPlayed: Number(profile.minutesPlayed || 0) + durationMinutes,
            lastPlayedGame: session.gameName,
            updatedAt: Date.now()
        };
        if (mode === "firebase") {
            await db.collection("playSessions").add({
                uid: user.uid,
                ...session,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection("users").doc(user.uid).set(update, { merge: true });
        } else {
            const sessions = read("gamezonePlaySessions", []);
            sessions.push({ id: uid(), uid: user.uid, ...session, createdAt: Date.now() });
            write("gamezonePlaySessions", sessions);
            const profiles = read("gamezoneProfiles", {});
            profiles[user.uid] = { ...profile, ...update };
            write("gamezoneProfiles", profiles);
        }
        return getUserProfile(user);
    }

    async function uploadFile(path, file) {
        if (!file) return "";
        if (mode !== "firebase") {
            return `local-upload://${path}/${file.name}`;
        }
        const ref = storage.ref(path);
        await ref.put(file);
        return ref.getDownloadURL();
    }

    async function uploadGame(payload) {
        const user = currentUser || localUser();
        if (!user) throw new Error("Login required");
        const uploadId = uid();
        const basePath = `gameUploads/${user.uid}/${uploadId}`;
        const [codeUrl, exeUrl, thumbnailUrl] = await Promise.all([
            uploadFile(`${basePath}/code/${payload.codeFile?.name || "code"}`, payload.codeFile),
            uploadFile(`${basePath}/exe/${payload.exeFile?.name || "game"}`, payload.exeFile),
            uploadFile(`${basePath}/thumbnail/${payload.thumbnailFile?.name || "thumbnail"}`, payload.thumbnailFile),
        ]);
        const game = {
            id: uploadId,
            ownerUid: user.uid,
            ownerName: user.displayName || user.email || "Player",
            title: payload.title,
            category: payload.category,
            description: payload.description,
            playType: payload.playType,
            playUrl: payload.playUrl || (payload.codeFile?.type === "text/html" ? codeUrl : ""),
            codeUrl,
            exeUrl,
            thumbnailUrl,
            status: "published",
            createdAt: Date.now()
        };
        if (mode === "firebase") {
            await db.collection("gameUploads").doc(uploadId).set({
                ...game,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const games = read("gamezoneUploadedGames", []);
            games.unshift(game);
            write("gamezoneUploadedGames", games);
        }
        return game;
    }

    async function listUploadedGames() {
        if (mode === "firebase") {
            const snap = await db.collection("gameUploads")
                .where("status", "==", "published")
                .limit(25)
                .get();
            return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        }
        return read("gamezoneUploadedGames", []);
    }

    async function sendFriendRequest(identifier) {
        const user = currentUser || localUser();
        if (!user) throw new Error("Login required");
        const search = identifier.trim().toLowerCase();
        if (!search) throw new Error("Enter email or username");
        const senderProfile = await getUserProfile(user);
        const targetProfile = await findUserByIdentifier(search);
        if (!targetProfile) throw new Error("User not found");
        if (targetProfile.uid === user.uid) throw new Error("You cannot add yourself");
        if (mode === "firebase") {
            await db.collection("friendRequests").add({
                fromUid: user.uid,
                fromName: senderProfile.displayName || user.displayName || user.email || "Player",
                fromEmail: user.email || "",
                toUid: targetProfile.uid,
                toName: targetProfile.displayName || targetProfile.username || search,
                toIdentifier: search,
                status: "pending",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        }
        const requests = read("gamezoneFriendRequests", []);
        const existing = requests.find((request) =>
            request.status === "pending"
            && ((request.fromUid === user.uid && request.toUid === targetProfile.uid)
                || (request.fromUid === targetProfile.uid && request.toUid === user.uid))
        );
        if (existing) throw new Error("Friend request already pending");
        requests.unshift({
            id: uid(),
            fromUid: user.uid,
            fromName: senderProfile.displayName || user.displayName || user.email || "Player",
            fromEmail: user.email || "",
            toUid: targetProfile.uid,
            toName: targetProfile.displayName || targetProfile.username || search,
            toIdentifier: search,
            status: "pending",
            createdAt: Date.now()
        });
        write("gamezoneFriendRequests", requests);
        return true;
    }

    async function listFriendRequests() {
        const user = currentUser || localUser();
        if (!user) return [];
        if (mode === "firebase") {
            const [incoming, outgoing] = await Promise.all([
                db.collection("friendRequests").where("toUid", "==", user.uid).limit(20).get(),
                db.collection("friendRequests").where("fromUid", "==", user.uid).limit(20).get()
            ]);
            const rows = [...incoming.docs, ...outgoing.docs].map((doc) => ({ id: doc.id, ...doc.data() }));
            return rows
                .filter((request, index, all) => all.findIndex((item) => item.id === request.id) === index)
                .map((request) => ({ ...request, direction: request.toUid === user.uid ? "incoming" : "outgoing" }));
        }
        return read("gamezoneFriendRequests", [])
            .filter((request) => request.fromUid === user.uid || request.toUid === user.uid)
            .map((request) => ({ ...request, direction: request.toUid === user.uid ? "incoming" : "outgoing" }));
    }

    async function respondToFriendRequest(requestId, status) {
        const user = currentUser || localUser();
        if (!user) throw new Error("Login required");
        if (!["accepted", "rejected"].includes(status)) throw new Error("Invalid request status");
        if (mode === "firebase") {
            const ref = db.collection("friendRequests").doc(requestId);
            const snap = await ref.get();
            if (!snap.exists) throw new Error("Request not found");
            const request = snap.data();
            if (request.toUid !== user.uid) throw new Error("Only receiver can respond");
            await ref.set({ status, respondedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            if (status === "accepted") {
                const friendshipId = [request.fromUid, request.toUid].sort().join("_");
                await db.collection("friendships").doc(friendshipId).set({
                    members: [request.fromUid, request.toUid],
                    memberNames: [request.fromName || "Player", request.toName || user.email || "Player"],
                    requestId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            return true;
        }
        const requests = read("gamezoneFriendRequests", []);
        const request = requests.find((item) => item.id === requestId);
        if (!request) throw new Error("Request not found");
        if (request.toUid !== user.uid) throw new Error("Only receiver can respond");
        request.status = status;
        request.respondedAt = Date.now();
        write("gamezoneFriendRequests", requests);
        if (status === "accepted") {
            const friendships = read("gamezoneFriendships", []);
            const friendshipId = [request.fromUid, request.toUid].sort().join("_");
            if (!friendships.find((item) => item.id === friendshipId)) {
                friendships.unshift({
                    id: friendshipId,
                    members: [request.fromUid, request.toUid],
                    memberNames: [request.fromName || "Player", request.toName || "Player"],
                    requestId,
                    createdAt: Date.now()
                });
                write("gamezoneFriendships", friendships);
            }
        }
        return true;
    }

    async function createTeam(name, gameName) {
        const user = currentUser || localUser();
        if (!user) throw new Error("Login required");
        const team = {
            id: uid(),
            name,
            gameName,
            ownerUid: user.uid,
            members: [user.uid],
            memberNames: [user.displayName || user.email || "Player"],
            createdAt: Date.now()
        };
        if (mode === "firebase") {
            const ref = await db.collection("teams").add({
                ...team,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { ...team, id: ref.id };
        }
        const teams = read("gamezoneTeams", []);
        teams.unshift(team);
        write("gamezoneTeams", teams);
        return team;
    }

    async function listTeams() {
        if (mode === "firebase") {
            const snap = await db.collection("teams").limit(20).get();
            return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        }
        return read("gamezoneTeams", []);
    }

    async function listLeaderboard() {
        if (mode === "firebase") {
            const snap = await db.collection("users").orderBy("points", "desc").limit(5).get();
            return snap.docs.map((doc, index) => ({ rank: index + 1, ...doc.data() }));
        }
        const profiles = Object.values(read("gamezoneProfiles", {}));
        return profiles
            .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
            .slice(0, 5)
            .map((profile, index) => ({ rank: index + 1, ...profile }));
    }

    function onAuthChanged(listener) {
        authListeners.push(listener);
        listener(mode === "firebase" ? currentUser : localUser());
    }

    window.GameZoneFirebase = {
        get mode() {
            return mode;
        },
        get configured() {
            return mode === "firebase";
        },
        onAuthChanged,
        signUp,
        signIn,
        signInAdmin,
        signOut: signOutUser,
        getUserProfile,
        saveUserProfile,
        awardPoints,
        claimDailyBonus,
        recordPlaySession,
        uploadGame,
        listUploadedGames,
        sendFriendRequest,
        listFriendRequests,
        respondToFriendRequest,
        getPublicProfile,
        createTeam,
        listTeams,
        listLeaderboard
    };

    tryFirebaseInit().then(() => {
        if (mode === "local") {
            currentUser = localUser();
            authListeners.forEach((listener) => listener(currentUser));
        }
        window.dispatchEvent(new CustomEvent("gamezone:firebase-ready", { detail: { mode } }));
    });
})();
