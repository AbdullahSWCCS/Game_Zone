/**
 * Admin Panel Logic
 * Handles all admin dashboard functionality
 */

let adminService = null;
let currentAdminUser = null;

document.addEventListener('DOMContentLoaded', initializeAdminPanel);

async function initializeAdminPanel() {
    // Wait for Firebase to be ready
    const firebaseReadyInterval = setInterval(() => {
        if (window.GameZoneFirebase) {
            clearInterval(firebaseReadyInterval);
            setupAdminPanel();
        }
    }, 100);
}

async function setupAdminPanel() {
    adminService = window.AdminManagementSystem;
    const firebaseService = window.GameZoneFirebase;

    // Check admin status
    firebaseService.onAuthChanged(async (user) => {
        if (!user) {
            window.location.href = '/admin/login.html';
            return;
        }

        const isAdmin = await adminService.isUserAdmin(user.uid);
        if (!isAdmin) {
            alert('Access Denied: Admin privileges required');
            window.location.href = '/admin/login.html';
            return;
        }

        currentAdminUser = user;
        setupEventListeners();
        loadDashboard();
    });
}

function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');

            const section = e.target.dataset.section;
            showSection(section);
        });
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.GameZoneFirebase.signOut();
        window.location.href = '/index.html';
    });

    // Search handlers
    document.getElementById('userSearch').addEventListener('input', (e) => {
        if (e.target.value.trim()) {
            filterUsersTable(e.target.value);
        }
    });

    document.getElementById('gameSearch').addEventListener('input', (e) => {
        if (e.target.value.trim()) {
            filterGamesTable(e.target.value);
        }
    });

    // Add Game Form
    document.getElementById('addGameForm').addEventListener('submit', handleAddGame);

    // Modal close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        });
    });

    // Confirm modal buttons
    document.getElementById('confirmNo').addEventListener('click', () => {
        document.getElementById('confirmModal').classList.remove('active');
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    // Load section data
    if (sectionId === 'dashboard') {
        loadDashboard();
    } else if (sectionId === 'users') {
        loadUsers();
    } else if (sectionId === 'games') {
        loadGames();
    } else if (sectionId === 'restricted') {
        loadRestrictedUsers();
    } else if (sectionId === 'logs') {
        loadAdminLogs();
    }
}

async function loadDashboard() {
    try {
        const stats = await adminService.getPlatformStats();

        const statsHTML = `
            <div class="stat-card">
                <div class="label">Total Users</div>
                <div class="value">${stats.totalUsers}</div>
            </div>
            <div class="stat-card">
                <div class="label">Active Users</div>
                <div class="value">${stats.activeUsers}</div>
            </div>
            <div class="stat-card">
                <div class="label">Blocked Users</div>
                <div class="value">${stats.blockedUsers}</div>
            </div>
            <div class="stat-card">
                <div class="label">Banned Users</div>
                <div class="value">${stats.bannedUsers}</div>
            </div>
            <div class="stat-card">
                <div class="label">Total Games</div>
                <div class="value">${stats.totalGames}</div>
            </div>
            <div class="stat-card">
                <div class="label">Online Games</div>
                <div class="value">${stats.onlineGames}</div>
            </div>
            <div class="stat-card">
                <div class="label">Downloadable Games</div>
                <div class="value">${stats.downloadableGames}</div>
            </div>
            <div class="stat-card">
                <div class="label">Total Plays</div>
                <div class="value">${stats.totalPlays}</div>
            </div>
            <div class="stat-card">
                <div class="label">Total Downloads</div>
                <div class="value">${stats.totalDownloads}</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg Points/User</div>
                <div class="value">${stats.avgPointsPerUser}</div>
            </div>
        `;

        document.getElementById('statsGrid').innerHTML = statsHTML;
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadUsers() {
    try {
        const users = await adminService.getAllUsers();
        let html = '';

        users.forEach(user => {
            const statusBadge = user.isBlocked ? '<span class="badge badge-blocked">Blocked</span>' :
                               user.isBanned ? '<span class="badge badge-banned">Banned</span>' :
                               '<span class="badge badge-active">Active</span>';

            const roleText = user.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : 'User';

            html += `
                <tr>
                    <td>${user.email}</td>
                    <td>${user.username || user.displayName || 'N/A'}</td>
                    <td>${roleText}</td>
                    <td>${user.points || 0}</td>
                    <td>${user.gamesPlayed || 0}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="action-btn btn-primary" onclick="showUserDetails('${user.uid}')">
                            View
                        </button>
                        <button class="action-btn btn-warning" onclick="editUserPoints('${user.uid}')">
                            Points
                        </button>
                    </td>
                </tr>
            `;
        });

        document.getElementById('usersTableBody').innerHTML = html || '<tr><td colspan="7">No users found</td></tr>';
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadGames() {
    try {
        const games = await window.GameManagementSystem.getAllGames({ limit: 100 });
        let html = '';

        games.forEach(game => {
            const typeText = (game.isOnline ? 'Online ' : '') + (game.isDownloadable ? 'Download' : 'N/A');

            html += `
                <tr>
                    <td>${game.emoji} ${game.name}</td>
                    <td>${game.category}</td>
                    <td>${typeText}</td>
                    <td>${game.plays || 0}</td>
                    <td>${game.downloads || 0}</td>
                    <td>${(game.rating || 0).toFixed(1)}⭐</td>
                    <td><span class="badge badge-active">${game.status}</span></td>
                    <td>
                        <button class="action-btn btn-primary" onclick="editGame('${game.gameId}')">
                            Edit
                        </button>
                        <button class="action-btn btn-danger" onclick="confirmDeleteGame('${game.gameId}', '${game.name}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        document.getElementById('gamesTableBody').innerHTML = html || '<tr><td colspan="8">No games found</td></tr>';
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

async function loadRestrictedUsers() {
    try {
        const restricted = await adminService.getRestrictedUsers();
        let html = '';

        restricted.forEach(user => {
            const dateBadge = new Date(user.blockedAt?.toDate?.() || user.bannedAt?.toDate?.() || Date.now()).toLocaleDateString();
            const reason = user.blockReason || user.banReason || 'No reason specified';

            html += `
                <tr>
                    <td>${user.email}</td>
                    <td>${user.username || user.displayName || 'N/A'}</td>
                    <td>
                        ${user.status === 'blocked' ? 
                            '<span class="badge badge-blocked">Blocked</span>' : 
                            '<span class="badge badge-banned">Banned</span>'}
                    </td>
                    <td>${reason}</td>
                    <td>${dateBadge}</td>
                    <td>
                        <button class="action-btn btn-success" onclick="confirmUnrestrict('${user.uid}', '${user.status}')">
                            Unrestrict
                        </button>
                    </td>
                </tr>
            `;
        });

        document.getElementById('restrictedTableBody').innerHTML = html || '<tr><td colspan="6">No restricted users</td></tr>';
    } catch (error) {
        console.error('Error loading restricted users:', error);
    }
}

async function loadAdminLogs() {
    try {
        const logs = await adminService.getAdminLogs(50);
        let html = '';

        logs.forEach(log => {
            const date = new Date(log.timestamp || log.createdAt).toLocaleString();
            const details = JSON.stringify(log.actionData).substring(0, 50) + '...';

            html += `
                <tr>
                    <td>${log.adminId || 'System'}</td>
                    <td><strong>${log.actionType}</strong></td>
                    <td>${log.actionData?.targetUserId || log.actionData?.gameId || 'N/A'}</td>
                    <td>${details}</td>
                    <td>${date}</td>
                </tr>
            `;
        });

        document.getElementById('logsTableBody').innerHTML = html || '<tr><td colspan="5">No logs found</td></tr>';
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

async function showUserDetails(userId) {
    try {
        const user = await window.GameZoneFirebase.getUserProfile({ uid: userId });
        const stats = await window.PointsSystem.getUserStatistics(userId);
        const activity = await adminService.getUserActivityLog(userId);

        const details = `
            <div style="margin-bottom: 15px;">
                <strong>Email:</strong> ${user.email}<br>
                <strong>Username:</strong> ${user.username || user.displayName}<br>
                <strong>Role:</strong> ${user.role === 'admin' ? 'Administrator' : 'User'}<br>
                <strong>Status:</strong> ${user.isBlocked ? 'Blocked' : user.isBanned ? 'Banned' : 'Active'}<br>
                <strong>Points:</strong> ${user.points || 0}<br>
                <strong>Level:</strong> ${user.level || 1}<br>
                <strong>Games Played:</strong> ${stats.gameCompletions}<br>
                <strong>Achievements:</strong> ${stats.achievementsUnlocked}<br>
                <strong>Current Rank:</strong> #${stats.currentRank}
            </div>
            <div style="border-top: 1px solid #e0e0e0; padding-top: 15px;">
                <strong>Quick Actions:</strong><br><br>
                ${user.role !== 'admin' ? 
                    `<button class="action-btn btn-primary" onclick="grantAdminAccess('${userId}')">Make Admin</button><br><br>` : 
                    `<button class="action-btn btn-warning" onclick="revokeAdminAccess('${userId}')">Revoke Admin</button><br><br>`
                }
                ${!user.isBlocked && !user.isBanned ?
                    `<button class="action-btn btn-danger" onclick="promptBlockUser('${userId}')">Block User</button><br><br>` :
                    ''
                }
                ${user.isBlocked ?
                    `<button class="action-btn btn-success" onclick="unblockUser('${userId}')">Unblock User</button><br><br>` :
                    ''
                }
                ${!user.isBanned ?
                    `<button class="action-btn btn-danger" onclick="promptBanUser('${userId}')">Ban User</button><br><br>` :
                    ''
                }
                ${user.isBanned ?
                    `<button class="action-btn btn-success" onclick="unbanUser('${userId}')">Unban User</button><br><br>` :
                    ''
                }
                <button class="action-btn btn-warning" onclick="promptAdjustPoints('${userId}')">Adjust Points</button><br><br>
                <button class="action-btn btn-warning" onclick="confirmResetAccount('${userId}')">Reset Account</button>
            </div>
        `;

        document.getElementById('userDetailsContent').innerHTML = details;
        document.getElementById('userDetailsModal').classList.add('active');
    } catch (error) {
        console.error('Error loading user details:', error);
    }
}

async function handleAddGame(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const gameData = {
        name: formData.get('name'),
        category: formData.get('category'),
        emoji: formData.get('emoji') || '🎮',
        author: formData.get('author'),
        description: formData.get('description'),
        link: formData.get('link'),
        imageUrl: formData.get('imageUrl'),
        isOnline: formData.get('isOnline') === 'on',
        isDownloadable: formData.get('isDownloadable') === 'on',
        downloadUrl: formData.get('downloadUrl'),
        downloadSize: parseInt(formData.get('downloadSize')) || 0
    };

    try {
        const gameId = await window.GameManagementSystem.addGame(gameData);
        alert(`✅ Game "${gameData.name}" added successfully!`);
        e.target.reset();
        showSection('games');
        loadGames();
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
}

async function grantAdminAccess(userId) {
    if (confirm('Grant admin access to this user?')) {
        await adminService.grantAdminAccess(userId);
        alert('✅ Admin access granted');
        loadUsers();
    }
}

async function revokeAdminAccess(userId) {
    if (confirm('Revoke admin access from this user?')) {
        await adminService.revokeAdminAccess(userId);
        alert('✅ Admin access revoked');
        loadUsers();
    }
}

function promptBlockUser(userId) {
    const reason = prompt('Enter block reason:');
    if (reason) {
        confirmBlockUser(userId, reason);
    }
}

async function confirmBlockUser(userId, reason) {
    await adminService.blockUser(userId, reason);
    alert('✅ User blocked');
    loadUsers();
    document.getElementById('userDetailsModal').classList.remove('active');
}

async function unblockUser(userId) {
    if (confirm('Unblock this user?')) {
        await adminService.unblockUser(userId);
        alert('✅ User unblocked');
        loadUsers();
        document.getElementById('userDetailsModal').classList.remove('active');
    }
}

function promptBanUser(userId) {
    const reason = prompt('Enter ban reason:');
    if (reason) {
        const days = prompt('Ban duration (days, 0 for permanent):');
        if (days !== null) {
            confirmBanUser(userId, reason, parseInt(days));
        }
    }
}

async function confirmBanUser(userId, reason, days) {
    await adminService.banUser(userId, reason, days);
    alert('✅ User banned');
    loadUsers();
    document.getElementById('userDetailsModal').classList.remove('active');
}

async function unbanUser(userId) {
    if (confirm('Unban this user?')) {
        await adminService.unbanUser(userId);
        alert('✅ User unbanned');
        loadUsers();
        document.getElementById('userDetailsModal').classList.remove('active');
    }
}

function promptAdjustPoints(userId) {
    const amount = prompt('Enter points adjustment amount (can be negative):');
    if (amount) {
        const reason = prompt('Reason for adjustment:');
        if (reason) {
            confirmAdjustPoints(userId, parseInt(amount), reason);
        }
    }
}

async function confirmAdjustPoints(userId, amount, reason) {
    await adminService.adjustUserPoints(userId, amount, reason);
    alert(`✅ Points adjusted by ${amount}`);
    loadUsers();
    document.getElementById('userDetailsModal').classList.remove('active');
}

async function confirmResetAccount(userId) {
    if (confirm('Reset this account to default state? This cannot be undone!')) {
        await adminService.resetUserAccount(userId);
        alert('✅ Account reset');
        loadUsers();
        document.getElementById('userDetailsModal').classList.remove('active');
    }
}

async function confirmUnrestrict(userId, status) {
    if (confirm(`Unrestrict this ${status} user?`)) {
        if (status === 'blocked') {
            await adminService.unblockUser(userId);
        } else {
            await adminService.unbanUser(userId);
        }
        alert('✅ Restriction removed');
        loadRestrictedUsers();
    }
}

function confirmDeleteGame(gameId, gameName) {
    if (confirm(`Delete game "${gameName}"?`)) {
        deleteGame(gameId);
    }
}

async function deleteGame(gameId) {
    await window.GameManagementSystem.deleteGame(gameId);
    alert('✅ Game deleted');
    loadGames();
}

function filterUsersTable(query) {
    const table = document.getElementById('usersTable');
    const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    const queryLower = query.toLowerCase();

    Array.from(rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(queryLower) ? '' : 'none';
    });
}

function filterGamesTable(query) {
    const table = document.getElementById('gamesTable');
    const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    const queryLower = query.toLowerCase();

    Array.from(rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(queryLower) ? '' : 'none';
    });
}

function editUserPoints(userId) {
    promptAdjustPoints(userId);
}

function editGame(gameId) {
    alert('Game editing feature coming soon!');
}
