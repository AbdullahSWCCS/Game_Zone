# 🎮 GameZone Platform - Complete Gaming Ecosystem

A comprehensive online gaming platform combining features from Epic Games, Steam, and CrazyGames. Users can play online games, download games, manage friends, track points, and earn achievements.

## 🌟 Key Features

### User Features
- **🎮 Game Library**: Browse and play hundreds of online games with categories
- **💾 Game Save/Resume**: Automatic game state saving - resume where you left off
- **⬇️ Game Downloads**: Download games to play offline
- **👥 Friend System**: Add friends, see what they're playing, compete on leaderboards
- **👑 Points & Achievements**: Earn points by playing games, unlock achievements
- **🏆 Leaderboards**: Global and friends-only leaderboards
- **🎯 Profile System**: Customize profile, track stats and achievements
- **🔔 Notifications**: Get notified about friend activities and rewards

### Admin Features
- **👥 User Management**: View all users, check stats, block/ban users
- **🎮 Game Management**: Add, edit, delete games easily
- **💰 Points Control**: Adjust user points for moderation/rewards
- **📊 Platform Statistics**: View platform-wide stats and trends
- **📋 Activity Logs**: Complete audit trail of all admin actions
- **🚫 Content Moderation**: Block/ban users, manage restricted users

---

## 📁 Project Structure

```
GameZone/
├── index.html                    # Main dashboard
├── admin/
│   ├── admin.html               # Admin panel UI
│   └── admin.js                 # Admin logic
├── core/
│   ├── game-save.js             # Game state persistence
│   ├── friends-system.js        # Friend management
│   ├── points-system.js         # Points & leaderboards
│   ├── game-management.js       # Game CRUD operations
│   └── admin-management.js      # Admin operations
├── firebase-config.js           # Firebase credentials
├── firebase-service.js          # Firebase wrapper
├── games-data.js                # Game catalog
├── script.js                    # Main app logic
├── styles.css                   # Main styles
├── firestore.rules              # Firestore security rules
├── storage.rules                # Cloud Storage rules
└── [Game Folders]/              # Individual games
```

---

## 🚀 Getting Started

### 1. Firebase Setup

Before using the platform with online features, configure Firebase:

1. Create a Firebase project at https://firebase.google.com
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Set up Cloud Storage
5. Copy your config to `firebase-config.js`:

```javascript
window.GAMEZONE_FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 2. Admin Setup

Set admin credentials in `firebase-config.js`:

```javascript
window.GAMEZONE_ADMIN_EMAIL = "admin@yourdomain.com";
window.GAMEZONE_ADMIN_PASSWORD = "securepassword";
```

### 3. Deploy Firestore Rules

Copy the rules from `firestore.rules` and `storage.rules` to your Firebase Console.

### 4. Run the Platform

```bash
# Local development
open index.html

# Or serve with a local server
python3 -m http.server 8000
# Visit http://localhost:8000
```

---

## 🎮 Core Systems

### 1. Game Save System (`core/game-save.js`)

Automatically saves game state and allows resuming from where players left off.

**Features:**
- Auto-save game progress
- Resume from last session
- Session history tracking
- Offline support

**Usage:**
```javascript
// Save game state
await GameSaveManager.saveGameState(userId, gameId, gameData, duration);

// Resume game
const session = await GameSaveManager.resumeGame(userId, gameId);
```

### 2. Friends System (`core/friends-system.js`)

Complete friend management with request handling and activity tracking.

**Features:**
- Send friend requests
- Accept/reject requests
- View friends list
- See what friends are playing
- Block users

**Usage:**
```javascript
// Send friend request
await FriendsSystem.sendFriendRequest(fromUserId, toUserId, toEmail);

// Accept request
await FriendsSystem.acceptFriendRequest(requestId, userId, userEmail);

// Get friends
const friends = await FriendsSystem.getFriendsList(userId);
```

### 3. Points System (`core/points-system.js`)

Comprehensive point tracking, achievements, and leaderboards.

**Features:**
- Award/deduct points
- Achievement system
- Global leaderboards
- Friends leaderboards
- Points history
- Daily bonuses

**Usage:**
```javascript
// Award points
await PointsSystem.awardPoints(userId, amount, 'reason');

// Award for game completion
await PointsSystem.awardGameCompletion(userId, gameId, duration, score);

// Get leaderboard
const leaderboard = await PointsSystem.getLeaderboard(100);

// Unlock achievement
await PointsSystem.unlockAchievement(userId, achievementId, name);
```

### 4. Game Management (`core/game-management.js`)

Full game catalog management with search, filtering, and reviews.

**Features:**
- Add/edit/delete games
- Game search and filtering
- Game reviews and ratings
- Play tracking
- Download tracking
- Game statistics

**Usage:**
```javascript
// Add new game
const gameId = await GameManagementSystem.addGame({
    name: "My Game",
    category: "action",
    link: "path/to/game.html",
    isOnline: true,
    isDownloadable: true
});

// Search games
const results = await GameManagementSystem.searchGames("puzzle", 20);

// Get game reviews
const reviews = await GameManagementSystem.getGameReviews(gameId);
```

### 5. Admin Management (`core/admin-management.js`)

Complete admin and moderation tools.

**Features:**
- User management (view, block, ban)
- Admin role management
- Point adjustments
- Account reset
- Activity logging
- Platform statistics

**Usage:**
```javascript
// Check admin status
const isAdmin = await AdminManagementSystem.isUserAdmin(userId);

// Block user
await AdminManagementSystem.blockUser(userId, "reason");

// Ban user
await AdminManagementSystem.banUser(userId, "reason", 7); // 7 days

// Adjust points
await AdminManagementSystem.adjustUserPoints(userId, 1000, "bonus");

// Get stats
const stats = await AdminManagementSystem.getPlatformStats();
```

---

## 📊 Database Schema

### Users Collection
```javascript
{
    uid: "user_id",
    email: "user@example.com",
    username: "username",
    displayName: "Display Name",
    role: "user" | "admin",
    points: 5000,
    coins: 1250,
    level: 5,
    gamesPlayed: 42,
    minutesPlayed: 1200,
    avatar: "GZ",
    avatarImage: "url",
    isBlocked: false,
    isBanned: false,
    createdAt: timestamp,
    updatedAt: timestamp
}
```

### Games Collection
```javascript
{
    gameId: "game_id",
    name: "Game Name",
    category: "action",
    emoji: "🎮",
    link: "path/to/game.html",
    description: "Game description",
    author: "Author Name",
    isOnline: true,
    isDownloadable: true,
    downloadUrl: "https://...",
    downloadSize: 50,
    imageUrl: "https://...",
    rating: 4.5,
    downloads: 1000,
    plays: 5000,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
}
```

### User Sessions Collection
```javascript
{
    sessionId: "game_id_timestamp",
    userId: "user_id",
    gameId: "game_id",
    gameData: { /* game state */ },
    duration: 1200,
    status: "active" | "completed",
    lastSavedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
}
```

### Friend Requests Collection
```javascript
{
    requestId: "req_id",
    fromUserId: "user_id",
    toUserId: "user_id",
    toEmail: "user@example.com",
    status: "pending" | "accepted" | "rejected",
    createdAt: timestamp,
    respondedAt: timestamp
}
```

### Points History Collection
```javascript
{
    transactionId: "txn_id",
    userId: "user_id",
    amount: 100,
    reason: "game_completion" | "daily_bonus" | "achievement",
    metadata: { /* additional data */ },
    createdAt: timestamp
}
```

---

## 🎯 Admin Panel Guide

### Access Admin Panel
1. Click "Admin Login" on the login page
2. Enter admin credentials
3. Access admin panel at `/admin/admin.html`

### Admin Operations

#### 1. Dashboard
- View platform statistics
- Monitor user and game metrics
- Track activity trends

#### 2. User Management
- View all users with details
- Adjust user points
- Grant/revoke admin access
- Block/ban users for violations

#### 3. Game Management
- View all games in catalog
- Add new games easily
- Edit game information
- Delete games
- Track game statistics

#### 4. Add New Game
- Fill in game details (name, category, etc.)
- Specify if online/downloadable
- Add download link if downloadable
- Set game emoji and image

#### 5. User Restrictions
- View blocked and banned users
- See restriction reasons and dates
- Unrestrict users when appropriate

#### 6. Admin Logs
- Track all admin actions
- See who did what and when
- Audit trail for moderation

---

## 🏆 Points System

### How Users Earn Points

- **Playing Games**: 100 points per game + 5 points per minute played
- **Daily Bonus**: 500 points for claiming daily bonus (once per day)
- **Achievements**: 250 points per achievement unlocked
- **Friend Bonuses**: Extra points for friend activities

### Leaderboard System

- **Global Leaderboard**: Top 100 players by points
- **Friends Leaderboard**: Rankings among friends only
- **User Rank**: Calculate user's position in global rankings
- **Seasonal**: Monthly resets for seasonal competitions

---

## 🤝 Friend System

### Friend Workflow

1. **Send Request**: User sends friend request to another player
2. **Notification**: Recipient receives notification
3. **Accept/Reject**: Recipient can accept or reject
4. **Bidirectional**: Friendship is mutual once accepted
5. **View Activity**: Can see what friends are playing
6. **Block**: Option to block specific users

---

## 💾 Game Save/Resume

### How It Works

1. **On Game Start**: Check for existing saved session
2. **Auto-Save**: Save game state at intervals
3. **On Exit**: Final save with completion metadata
4. **On Resume**: Load previous state automatically
5. **Progress Tracking**: Record play time and sessions

### Implementation

```javascript
// Initialize game save
const gameSave = new GameSaveManager();

// Load previous session if exists
const session = await gameSave.resumeGame(userId, gameId);
if (session) {
    loadGameState(session.gameData);
}

// During gameplay, periodically save
setInterval(async () => {
    await gameSave.saveGameState(userId, gameId, currentGameData);
}, 30000); // Save every 30 seconds

// On game exit
await gameSave.closeGameSession(sessionId, finalGameData);
```

---

## 🔒 Security

### Firestore Rules

Rules in `firestore.rules` ensure:
- Users can only access their own data
- Admins can access all data
- Public read access for game catalog
- Restricted write access for sensitive collections

### Best Practices

1. Never expose sensitive credentials in frontend code
2. Use Firebase Security Rules for data protection
3. Validate all admin actions server-side
4. Log all administrative activities
5. Regularly review access logs
6. Implement rate limiting for API calls

---

## 📱 Responsive Design

The platform is fully responsive and works on:
- Desktop computers (1920px+)
- Tablets (768px - 1024px)
- Mobile phones (320px - 767px)

Features adapt automatically for different screen sizes.

---

## 🐛 Troubleshooting

### Games Not Loading
- Check if game links in `games-data.js` are correct
- Verify file paths exist
- Check browser console for errors

### Points Not Updating
- Ensure Firebase is properly configured
- Check Firestore rules allow write access
- Verify user is logged in

### Friend System Not Working
- Check if both users are registered
- Verify friend request collection exists
- Check browser console for errors

### Admin Panel Access Denied
- Verify admin email/password in config
- Check user's role is set to "admin" in database
- Clear browser cache and try again

---

## 📈 Performance Tips

1. **Cache Games**: Load games data at startup
2. **Lazy Load**: Only load user data when needed
3. **Batch Operations**: Combine multiple database calls
4. **CDN**: Serve static assets from CDN
5. **Database Indexes**: Index frequently queried fields

---

## 🔄 Deployment

### Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy
firebase deploy

# View logs
firebase functions:log
```

### Deploy to Netlify

1. Connect GitHub repository
2. Set build command: (leave empty for static site)
3. Set publish directory: `/`
4. Deploy

---

## 📚 API Reference

### GameSaveManager
- `saveGameState(userId, gameId, gameData, duration)`
- `loadGameState(userId, gameId)`
- `resumeGame(userId, gameId)`
- `closeGameSession(sessionId, finalGameData)`
- `getUserSessions(userId)`

### FriendsSystem
- `sendFriendRequest(fromUserId, toUserId, toEmail)`
- `acceptFriendRequest(requestId, userId, userEmail)`
- `rejectFriendRequest(requestId)`
- `getFriendsList(userId)`
- `getFriendActivity(friendId)`
- `removeFriend(userId, friendId)`
- `blockUser(userId, blockedUserId)`
- `getBlockedUsers(userId)`

### PointsSystem
- `awardPoints(userId, amount, reason)`
- `deductPoints(userId, amount, reason)`
- `awardGameCompletion(userId, gameId, duration, score)`
- `awardDailyBonus(userId)`
- `unlockAchievement(userId, achievementId, name)`
- `getLeaderboard(limit)`
- `getFriendsLeaderboard(userId)`
- `getUserRank(userId)`
- `getUserStatistics(userId)`

### GameManagementSystem
- `addGame(gameData)`
- `updateGame(gameId, updateData)`
- `deleteGame(gameId)`
- `getGame(gameId)`
- `getAllGames(filters)`
- `searchGames(query, limit)`
- `getTrendingGames(limit)`
- `addGameReview(userId, gameId, rating, review)`
- `getGameReviews(gameId)`

### AdminManagementSystem
- `isUserAdmin(userId)`
- `grantAdminAccess(userId)`
- `revokeAdminAccess(userId)`
- `blockUser(userId, reason)`
- `unblockUser(userId)`
- `banUser(userId, reason, banDurationDays)`
- `unbanUser(userId)`
- `adjustUserPoints(userId, adjustment, reason)`
- `resetUserAccount(userId)`
- `getPlatformStats()`
- `getAdminLogs(limit)`

---

## 🎓 Learning Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Web Development Best Practices](https://web.dev)
- [Game Development Tips](https://gamedev.stackexchange.com)

---

## 📝 License

This project is open source and available under the MIT License.

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📧 Support

For issues, questions, or suggestions, please:
- Open an issue on GitHub
- Contact the admin team
- Email: support@gamezone.local

---

**Built with ❤️ | GameZone Platform**
