# GameZone Firebase Setup

This dashboard is now Firebase-ready. It runs in local demo mode until you paste the Firebase web app config.

## 1. Paste Firebase Config

Open `firebase-config.js` and replace the placeholder values with your Firebase Web App config from:

Firebase Console -> Project settings -> General -> Your apps -> Web app.

Project id is already set to `gamezone-523f4`.

## 2. Enable Firebase Products

In Firebase Console:

1. Enable Authentication -> Email/Password.
2. Create Cloud Firestore database.
3. Enable Cloud Storage.
4. Paste `firestore.rules` into Firestore Rules.
5. Paste `storage.rules` into Storage Rules.

## 3. Current Features

- User signup/signin
- Player profile/details
- Points, coins, level, play sessions
- 30-minute play reward
- Level-complete reward button
- Game upload metadata
- Code/EXE/thumbnail upload to Firebase Storage
- Uploaded games list
- Friend request records
- Team records
- Leaderboard from saved user points

## 4. Important Security Note

The frontend can record points for the MVP. For production, move point awarding into Cloud Functions so users cannot cheat by editing browser code.

Recommended production flow:

- Frontend writes `playSessions`.
- Cloud Function verifies duration/level event.
- Cloud Function writes `pointsLedger` and updates `users/{uid}`.

## 5. Multiplayer

Firestore is good for profiles, friends, teams, scores, and lobbies. For real-time multiplayer movement, use the included Socket.IO server scaffold in `realtime-server/`.

Run it later with:

```bash
cd realtime-server
npm install
npm start
```

Deploy options: Cloud Run, Render, Railway, Fly.io, or a VPS.
