/**
 * Points & Leaderboard System
 * Manages user points, achievements, and leaderboards
 */

class PointsSystem {
    constructor() {
        this.service = window.GameZoneFirebase;
    }

    // Point constants
    static POINTS_PER_GAME = 100;
    static POINTS_PER_MINUTE = 5;
    static DAILY_BONUS = 500;
    static ACHIEVEMENT_BONUS = 250;

    /**
     * Award points to user
     */
    async awardPoints(userId, amount, reason = 'gameplay', metadata = {}) {
        if (!userId || amount <= 0) throw new Error('Invalid user or points amount');

        const transactionId = `txn_${userId}_${Date.now()}`;
        const transaction = {
            transactionId,
            userId,
            amount,
            reason,
            metadata,
            createdAt: Date.now()
        };

        if (this.service.mode === 'firebase') {
            try {
                const userRef = this.service.db.collection('users').doc(userId);
                
                await Promise.all([
                    userRef.update({
                        points: firebase.firestore.FieldValue.increment(amount),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }),
                    this.service.db.collection('points_history').doc(transactionId).set(transaction)
                ]);

                return transactionId;
            } catch (error) {
                console.error('Error awarding points:', error);
                return this.awardPointsLocal(transaction);
            }
        } else {
            return this.awardPointsLocal(transaction);
        }
    }

    /**
     * Award points locally
     */
    awardPointsLocal(transaction) {
        const history = JSON.parse(localStorage.getItem('gamezone_points_history') || '[]');
        history.push(transaction);
        localStorage.setItem('gamezone_points_history', JSON.stringify(history));

        // Update user profile
        const profile = JSON.parse(localStorage.getItem('gamezoneLocalUserProfile') || '{}');
        profile.points = (profile.points || 0) + transaction.amount;
        localStorage.setItem('gamezoneLocalUserProfile', JSON.stringify(profile));

        return transaction.transactionId;
    }

    /**
     * Deduct points from user
     */
    async deductPoints(userId, amount, reason = 'penalty') {
        return this.awardPoints(userId, -amount, reason);
    }

    /**
     * Award points for completing a game
     */
    async awardGameCompletion(userId, gameId, duration, score = 0) {
        const basePoints = PointsSystem.POINTS_PER_GAME;
        const timePoints = Math.round((duration / 60) * PointsSystem.POINTS_PER_MINUTE);
        const totalPoints = basePoints + timePoints;

        return this.awardPoints(userId, totalPoints, 'game_completion', {
            gameId,
            duration,
            score
        });
    }

    /**
     * Award daily bonus
     */
    async awardDailyBonus(userId) {
        return this.awardPoints(userId, PointsSystem.DAILY_BONUS, 'daily_bonus', {
            claimedAt: Date.now()
        });
    }

    /**
     * Unlock achievement
     */
    async unlockAchievement(userId, achievementId, achievementName) {
        const achievementData = {
            userId,
            achievementId,
            name: achievementName,
            unlockedAt: Date.now()
        };

        if (this.service.mode === 'firebase') {
            try {
                await Promise.all([
                    this.service.db.collection('achievements')
                        .doc(`${userId}_${achievementId}`)
                        .set(achievementData, { merge: true }),
                    this.awardPoints(userId, PointsSystem.ACHIEVEMENT_BONUS, 'achievement', {
                        achievementId
                    })
                ]);
                return true;
            } catch (error) {
                console.error('Error unlocking achievement:', error);
                return false;
            }
        } else {
            const achievements = JSON.parse(localStorage.getItem('gamezone_achievements') || '[]');
            if (!achievements.find(a => a.userId === userId && a.achievementId === achievementId)) {
                achievements.push(achievementData);
                localStorage.setItem('gamezone_achievements', JSON.stringify(achievements));
                this.awardPointsLocal({
                    transactionId: `ach_${userId}_${Date.now()}`,
                    userId,
                    amount: PointsSystem.ACHIEVEMENT_BONUS,
                    reason: 'achievement',
                    metadata: { achievementId },
                    createdAt: Date.now()
                });
            }
            return true;
        }
    }

    /**
     * Get user's points history
     */
    async getPointsHistory(userId, limit = 20) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('points_history')
                    .where('userId', '==', userId)
                    .orderBy('createdAt', 'desc')
                    .limit(limit)
                    .get();
                return snapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.error('Error fetching points history:', error);
                return [];
            }
        } else {
            const history = JSON.parse(localStorage.getItem('gamezone_points_history') || '[]');
            return history.filter(h => h.userId === userId)
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, limit);
        }
    }

    /**
     * Get user's achievements
     */
    async getUserAchievements(userId) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('achievements')
                    .where('userId', '==', userId)
                    .orderBy('unlockedAt', 'desc')
                    .get();
                return snapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.error('Error fetching achievements:', error);
                return [];
            }
        } else {
            const achievements = JSON.parse(localStorage.getItem('gamezone_achievements') || '[]');
            return achievements.filter(a => a.userId === userId)
                .sort((a, b) => b.unlockedAt - a.unlockedAt);
        }
    }

    /**
     * Get global leaderboard
     */
    async getLeaderboard(limit = 100) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('users')
                    .orderBy('points', 'desc')
                    .limit(limit)
                    .get();
                
                return snapshot.docs.map((doc, index) => ({
                    rank: index + 1,
                    ...doc.data()
                }));
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
                return [];
            }
        } else {
            const accounts = JSON.parse(localStorage.getItem('gamezoneLocalAccounts') || '{}');
            return Object.values(accounts)
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .slice(0, limit)
                .map((user, index) => ({
                    rank: index + 1,
                    ...user
                }));
        }
    }

    /**
     * Get leaderboard for friends
     */
    async getFriendsLeaderboard(userId) {
        const friends = await window.FriendsSystem.getFriendsList(userId);
        const friendIds = friends.map(f => f.friendId);

        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('users')
                    .where('uid', 'in', friendIds)
                    .orderBy('points', 'desc')
                    .get();
                
                return snapshot.docs.map((doc, index) => ({
                    rank: index + 1,
                    ...doc.data()
                }));
            } catch (error) {
                console.error('Error fetching friends leaderboard:', error);
                return [];
            }
        } else {
            const accounts = JSON.parse(localStorage.getItem('gamezoneLocalAccounts') || '{}');
            return Object.values(accounts)
                .filter(a => friendIds.includes(a.uid))
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .map((user, index) => ({
                    rank: index + 1,
                    ...user
                }));
        }
    }

    /**
     * Get user's rank in leaderboard
     */
    async getUserRank(userId) {
        if (this.service.mode === 'firebase') {
            try {
                const userDoc = await this.service.db.collection('users').doc(userId).get();
                if (!userDoc.exists) return null;

                const userPoints = userDoc.data().points || 0;
                const snapshot = await this.service.db.collection('users')
                    .where('points', '>', userPoints)
                    .get();

                return snapshot.size + 1;
            } catch (error) {
                console.error('Error getting user rank:', error);
                return null;
            }
        } else {
            const accounts = JSON.parse(localStorage.getItem('gamezoneLocalAccounts') || '{}');
            const userPoints = accounts[userId]?.points || 0;
            const rank = Object.values(accounts)
                .filter(a => (a.points || 0) > userPoints).length + 1;
            return rank;
        }
    }

    /**
     * Get statistics for user
     */
    async getUserStatistics(userId) {
        const pointsHistory = await this.getPointsHistory(userId, 1000);
        const achievements = await this.getUserAchievements(userId);
        const rank = await this.getUserRank(userId);

        const totalPointsEarned = pointsHistory
            .filter(p => p.amount > 0)
            .reduce((sum, p) => sum + p.amount, 0);

        const gameCompletions = pointsHistory
            .filter(p => p.reason === 'game_completion').length;

        const dailyBonusClaimed = pointsHistory
            .filter(p => p.reason === 'daily_bonus').length;

        return {
            totalPointsEarned,
            gameCompletions,
            dailyBonusClaimed,
            achievementsUnlocked: achievements.length,
            currentRank: rank,
            lastUpdated: Date.now()
        };
    }
}

// Create global instance
window.PointsSystem = new PointsSystem();
