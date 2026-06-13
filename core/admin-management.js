/**
 * Admin Management System
 * Handles admin operations for users, games, and platform management
 */

class AdminManagementSystem {
    constructor() {
        this.service = window.GameZoneFirebase;
    }

    /**
     * Check if user is admin
     */
    async isUserAdmin(userId) {
        if (this.service.mode === 'firebase') {
            try {
                const userDoc = await this.service.db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    return userDoc.data().role === 'admin';
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
            }
        } else {
            const profiles = JSON.parse(localStorage.getItem('gamezoneProfiles') || '{}');
            const profile = profiles[userId] || {};
            return profile.role === 'admin';
        }
        return false;
    }

    /**
     * Grant admin access to user
     */
    async grantAdminAccess(userId) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('users').doc(userId).update({
                    role: 'admin',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                this.logAdminAction('grant_admin', {
                    targetUserId: userId
                });
                return true;
            } catch (error) {
                console.error('Error granting admin access:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Revoke admin access from user
     */
    async revokeAdminAccess(userId) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('users').doc(userId).update({
                    role: 'user',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.logAdminAction('revoke_admin', {
                    targetUserId: userId
                });
                return true;
            } catch (error) {
                console.error('Error revoking admin access:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Get all users (admin view)
     */
    async getAllUsers(filters = {}) {
        if (this.service.mode === 'firebase') {
            try {
                let query = this.service.db.collection('users');

                if (filters.role) {
                    query = query.where('role', '==', filters.role);
                }

                query = query.orderBy('createdAt', 'desc');

                if (filters.limit) {
                    query = query.limit(filters.limit);
                }

                const snapshot = await query.get();
                return snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                console.error('Error fetching users:', error);
                return [];
            }
        } else {
            const accounts = JSON.parse(localStorage.getItem('gamezoneLocalAccounts') || '{}');
            return Object.entries(accounts).map(([key, user]) => ({
                uid: user.uid || key,
                ...user
            }));
        }
    }

    /**
     * Block user
     */
    async blockUser(userId, reason = '') {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('users').doc(userId).update({
                    isBlocked: true,
                    blockReason: reason,
                    blockedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.logAdminAction('block_user', {
                    targetUserId: userId,
                    reason
                });
                return true;
            } catch (error) {
                console.error('Error blocking user:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Unblock user
     */
    async unblockUser(userId) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('users').doc(userId).update({
                    isBlocked: false,
                    blockReason: '',
                    blockedAt: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.logAdminAction('unblock_user', {
                    targetUserId: userId
                });
                return true;
            } catch (error) {
                console.error('Error unblocking user:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Ban user
     */
    async banUser(userId, reason = '', banDurationDays = 0) {
        if (this.service.mode === 'firebase') {
            try {
                const banUntil = banDurationDays > 0 ? 
                    Date.now() + (banDurationDays * 24 * 60 * 60 * 1000) : null;

                await this.service.db.collection('users').doc(userId).update({
                    isBanned: true,
                    banReason: reason,
                    bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    banUntil,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.logAdminAction('ban_user', {
                    targetUserId: userId,
                    reason,
                    banDurationDays
                });
                return true;
            } catch (error) {
                console.error('Error banning user:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Unban user
     */
    async unbanUser(userId) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('users').doc(userId).update({
                    isBanned: false,
                    banReason: '',
                    bannedAt: null,
                    banUntil: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.logAdminAction('unban_user', {
                    targetUserId: userId
                });
                return true;
            } catch (error) {
                console.error('Error unbanning user:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Get blocked/banned users list
     */
    async getRestrictedUsers() {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('users')
                    .where('isBlocked', '==', true)
                    .get();

                const bannedSnapshot = await this.service.db.collection('users')
                    .where('isBanned', '==', true)
                    .get();

                const blocked = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    status: 'blocked',
                    ...doc.data()
                }));

                const banned = bannedSnapshot.docs.map(doc => ({
                    uid: doc.id,
                    status: 'banned',
                    ...doc.data()
                }));

                return [...blocked, ...banned];
            } catch (error) {
                console.error('Error fetching restricted users:', error);
                return [];
            }
        }
        return [];
    }

    /**
     * Adjust user points
     */
    async adjustUserPoints(userId, adjustment, reason = 'admin_adjustment') {
        if (this.service.mode === 'firebase') {
            try {
                const userRef = this.service.db.collection('users').doc(userId);
                
                await Promise.all([
                    userRef.update({
                        points: firebase.firestore.FieldValue.increment(adjustment),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }),
                    this.service.db.collection('points_history').add({
                        userId,
                        amount: adjustment,
                        reason,
                        adminId: this.service.currentUser?.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                ]);

                this.logAdminAction('adjust_points', {
                    targetUserId: userId,
                    adjustment,
                    reason
                });
                return true;
            } catch (error) {
                console.error('Error adjusting points:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Reset user account
     */
    async resetUserAccount(userId) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('users').doc(userId).update({
                    points: 1250,
                    coins: 1250,
                    level: 1,
                    gamesPlayed: 0,
                    minutesPlayed: 0,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.logAdminAction('reset_account', {
                    targetUserId: userId
                });
                return true;
            } catch (error) {
                console.error('Error resetting account:', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Get admin logs
     */
    async getAdminLogs(limit = 50) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('admin_logs')
                    .orderBy('createdAt', 'desc')
                    .limit(limit)
                    .get();
                
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                console.error('Error fetching admin logs:', error);
                return [];
            }
        } else {
            const logs = JSON.parse(localStorage.getItem('gamezone_admin_logs') || '[]');
            return logs.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
        }
    }

    /**
     * Log admin action
     */
    async logAdminAction(actionType, actionData = {}) {
        const logEntry = {
            adminId: this.service.currentUser?.uid || 'local_admin',
            actionType,
            actionData,
            timestamp: Date.now(),
            createdAt: Date.now()
        };

        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('admin_logs').add(logEntry);
            } catch (error) {
                console.error('Error logging admin action:', error);
                this.logAdminActionLocal(logEntry);
            }
        } else {
            this.logAdminActionLocal(logEntry);
        }
    }

    /**
     * Log admin action locally
     */
    logAdminActionLocal(logEntry) {
        const logs = JSON.parse(localStorage.getItem('gamezone_admin_logs') || '[]');
        logs.push(logEntry);
        localStorage.setItem('gamezone_admin_logs', JSON.stringify(logs));
    }

    /**
     * Get platform statistics
     */
    async getPlatformStats() {
        const users = await this.getAllUsers();
        const games = await window.GameManagementSystem.getAllGames({ limit: 1000 });
        
        const totalUsers = users.length;
        const totalGames = games.length;
        const activeUsers = users.filter(u => !u.isBlocked && !u.isBanned).length;
        const blockedUsers = users.filter(u => u.isBlocked).length;
        const bannedUsers = users.filter(u => u.isBanned).length;

        const totalPoints = users.reduce((sum, u) => sum + (u.points || 0), 0);
        const avgPointsPerUser = totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0;

        const totalPlays = games.reduce((sum, g) => sum + (g.plays || 0), 0);
        const totalDownloads = games.reduce((sum, g) => sum + (g.downloads || 0), 0);

        return {
            totalUsers,
            activeUsers,
            blockedUsers,
            bannedUsers,
            totalGames,
            onlineGames: games.filter(g => g.isOnline).length,
            downloadableGames: games.filter(g => g.isDownloadable).length,
            totalPoints,
            avgPointsPerUser,
            totalPlays,
            totalDownloads,
            timestamp: Date.now()
        };
    }

    /**
     * Get user activity log
     */
    async getUserActivityLog(userId, limit = 20) {
        if (this.service.mode === 'firebase') {
            try {
                const sessions = await this.service.db.collection('user_sessions')
                    .where('userId', '==', userId)
                    .orderBy('createdAt', 'desc')
                    .limit(limit)
                    .get();

                return sessions.docs.map(doc => ({
                    type: 'game_session',
                    ...doc.data()
                }));
            } catch (error) {
                console.error('Error fetching user activity:', error);
                return [];
            }
        }
        return [];
    }
}

// Create global instance
window.AdminManagementSystem = new AdminManagementSystem();
