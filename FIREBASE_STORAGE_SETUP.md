# Firebase Storage Setup & Testing Guide

## ✅ What Was Fixed

**Before**: Admin games used Google Drive links → User clicked download → Redirected to Drive preview (not executable)

**After**: Admin games upload exe directly to Firebase Storage → User downloads → Saves to Downloads folder → Can execute directly

---

## 🔧 Setup Steps

### Step 1: Verify Firebase Config
Open `firebase-config.js` and check:
```javascript
window.GAMEZONE_FIREBASE_CONFIG = {
    apiKey: "YOUR_REAL_API_KEY",           // ❌ NOT "PASTE_API_KEY_HERE"
    authDomain: "gamezone-523f4.firebaseapp.com",
    projectId: "gamezone-523f4",
    storageBucket: "gamezone-523f4.appspot.com",  // Must have .appspot.com
    messagingSenderId: "YOUR_SENDER_ID",   // ❌ NOT "PASTE_..."
    appId: "YOUR_APP_ID"                   // ❌ NOT "PASTE_..."
};
```

If any say "PASTE_", Firebase is disabled → **Fix config first**

### Step 2: Add Firebase Storage Rules
In Firebase Console → Storage → Rules tab, paste:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Admin uploads games
    match /admin_games/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.isAdmin == true;
    }
    
    // Users upload games
    match /gameUploads/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

### Step 3: Make Admin User in Firebase Console
In Firestore → users collection → Find your admin email → Set:
```
role: "admin"
```

---

## 🧪 Testing Checklist

### Test 1: Admin Login & Upload
```
1. Go to /admin/admin.html
2. Login with your admin credentials
3. Go to "Add Game" section
4. Fill in:
   - Game Name: "Test Game"
   - Category: "arcade"
   - Is Downloadable: ✓ (checked)
   - Download File: Select a .exe or .zip file
5. Click "Add Game"
6. Should see: "✅ Game added successfully! ✓ File stored on Firebase Storage"
```

**Expected Results**:
- ✓ File uploaded to Firebase Storage (can verify in Firebase Console → Storage)
- ✓ Game appears in Downloads section
- ✓ downloadUrl contains `firebasestorage.googleapis.com`

### Test 2: User Download
```
1. Go to main GameZone site
2. Find the test game you added
3. Click download badge (⬇) or download button
4. Browser should show download popup
5. File saves to ~/Downloads folder
6. Should see notification: "✓ Downloading: Test Game (X.XX MB)"
```

**Expected Results**:
- ✓ File appears in Downloads folder
- ✓ File name is correct (e.g., Test_Game.exe)
- ✓ File size matches original
- ✓ Can execute file immediately after download

### Test 3: Download Manager
```
1. Click game download badge
2. Go to Downloads workspace
3. Should see file in "Active Downloads"
4. After ~5 seconds, moves to "Completed"
5. Click "Open" button
6. File opens from your download folder
```

### Test 4: Cross-Account Persistence
```
1. Logout and login with different account
2. Search for the game you added
3. Should see same game with same download link
4. Download should work for this account too
5. Game data should sync across Firebase (not local-only)
```

---

## 🐛 Troubleshooting

### Problem: "Firebase not configured" Warning
**Solution**: Update `firebase-config.js` with real API keys from Firebase Console

### Problem: Upload button disabled
**Solution**: Check if user is admin (role == "admin" in Firestore)

### Problem: Download says "Local mode"
**Solution**: Firebase config incomplete or not initialized. Check browser console for errors.

### Problem: Download redirect to Drive
**Solution**: Game still has old Drive link. Delete game and re-upload with file.

### Problem: Downloaded file won't execute
**Solution**: 
- Check file is actually .exe (not corrupted during upload)
- Windows may block it - right-click → Properties → Unblock

---

## 📁 File Locations

- **Admin Form**: `/admin/admin.html` (lines 510-540)
- **Upload Handler**: `/admin/admin.js` → `handleAddGame()` function
- **Download Logic**: `/script.js` → `downloadGameFile()` function
- **URL Normalization**: `/core/game-management.js` → `normalizeDownloadUrl()`
- **Firebase Config**: `/firebase-config.js`

---

## 🔒 Security Notes

- Only admins can upload files (checked in `handleAddGame()`)
- Files stored in `admin_games/` prefix in Firebase Storage
- Storage rules restrict access (only authenticated users can read)
- Filename includes timestamp to prevent overwrites

---

## 📝 Implementation Details

### When Admin Adds Game with File:
1. File picked from HTML input
2. Upload path: `admin_games/{name}_{timestamp}_{originalFilename}`
3. File uploaded to Firebase Storage
4. Download URL retrieved: `https://firebasestorage.googleapis.com/v0/b/.../admin_games/...`
5. URL saved in Firestore game document
6. Size auto-calculated from file.size

### When User Downloads:
1. `downloadGameFile(url, name)` called
2. URL resolved via `resolveDirectDownloadUrl()`
3. Firebase Storage URL detected
4. File fetched as blob
5. Blob converted to object URL
6. Browser download dialog triggered
7. File saved to ~/Downloads folder
8. User can execute directly

---

**Status**: ✅ Ready to test!
