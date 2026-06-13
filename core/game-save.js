/**
 * Game Save & Resume System
 * Manages game state persistence and resuming
 */

class GameSaveManager {
    constructor() {
        this.service = window.GameZoneFirebase;
    }

    /**
     * Save game state and progress
     */
    async saveGameState(userId, gameId, gameData, sessionDuration = 0) {
        if (!userId || !gameId) throw new Error('Invalid user or game ID');

        const sessionId = `${gameId}_${Date.now()}`;
        const sessionData = {
            userId,
            gameId,
            sessionId,
            gameData: gameData || {},
            duration: sessionDuration,
            status: 'active',
            lastSavedAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('user_sessions')
                    .doc(sessionId)
                    .set(sessionData, { merge: true });
                    
                // Update game stats
                await this.updateGameStats(userId, gameId, sessionDuration);
                return sessionId;
            } catch (error) {
                console.error('Error saving to Firebase:', error);
                return this.saveGameStateLocal(sessionData);
            }
        } else {
            return this.saveGameStateLocal(sessionData);
        }
    }

    /**
     * Save game state locally
     */
    saveGameStateLocal(sessionData) {
        const sessions = JSON.parse(localStorage.getItem('gamezone_sessions') || '[]');
        const existingIndex = sessions.findIndex(s => s.sessionId === sessionData.sessionId);
        
        if (existingIndex >= 0) {
            sessions[existingIndex] = { ...sessions[existingIndex], ...sessionData };
        } else {
            sessions.push(sessionData);
        }
        
        localStorage.setItem('gamezone_sessions', JSON.stringify(sessions));
        return sessionData.sessionId;
    }

    /**
     * Load game state for resuming
     */
    async loadGameState(userId, gameId) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('user_sessions')
                    .where('userId', '==', userId)
                    .where('gameId', '==', gameId)
                    .where('status', '==', 'active')
                    .orderBy('updatedAt', 'desc')
                    .limit(1)
                    .get();

                if (!snapshot.empty) {
                    return snapshot.docs[0].data();
                }
            } catch (error) {
                console.error('Error loading from Firebase:', error);
            }
        }
        
        return this.loadGameStateLocal(userId, gameId);
    }

    /**
     * Load game state locally
     */
    loadGameStateLocal(userId, gameId) {
        const sessions = JSON.parse(localStorage.getItem('gamezone_sessions') || '[]');
        return sessions.find(s => s.userId === userId && s.gameId === gameId && s.status === 'active');
    }

    /**
     * Get all sessions for user
     */
    async getUserSessions(userId) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('user_sessions')
                    .where('userId', '==', userId)
                    .orderBy('updatedAt', 'desc')
                    .get();
                return snapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.error('Error fetching sessions:', error);
            }
        }
        
        const sessions = JSON.parse(localStorage.getItem('gamezone_sessions') || '[]');
        return sessions.filter(s => s.userId === userId).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /**
     * Resume game from saved state
     */
    async resumeGame(userId, gameId) {
        const session = await this.loadGameState(userId, gameId);
        if (session) {
            return {
                sessionId: session.sessionId,
                gameData: session.gameData,
                lastPlayedAt: session.updatedAt
            };
        }
        return null;
    }

    /**
     * Close game session
     */
    async closeGameSession(sessionId, finalGameData = {}) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('user_sessions')
                    .doc(sessionId)
                    .update({
                        status: 'completed',
                        finalGameData,
                        closedAt: Date.now()
                    });
            } catch (error) {
                console.error('Error closing session:', error);
            }
        } else {
            const sessions = JSON.parse(localStorage.getItem('gamezone_sessions') || '[]');
            const session = sessions.find(s => s.sessionId === sessionId);
            if (session) {
                session.status = 'completed';
                session.finalGameData = finalGameData;
                session.closedAt = Date.now();
                localStorage.setItem('gamezone_sessions', JSON.stringify(sessions));
            }
        }
    }

    /**
     * Update game statistics
     */
    async updateGameStats(userId, gameId, duration) {
        if (this.service.mode === 'firebase' && this.service.db) {
            try {
                const userRef = this.service.db.collection('users').doc(userId);
                const gameStatsRef = this.service.db.collection('game_stats')
                    .doc(`${userId}_${gameId}`);

                await userRef.update({
                    gamesPlayed: firebase.firestore.FieldValue.increment(1),
                    minutesPlayed: firebase.firestore.FieldValue.increment(Math.round(duration / 60)),
                    lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await gameStatsRef.set({
                    userId,
                    gameId,
                    playCount: firebase.firestore.FieldValue.increment(1),
                    totalPlayTime: firebase.firestore.FieldValue.increment(duration),
                    lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (error) {
                console.error('Error updating game stats:', error);
            }
        }
    }
}

// Create global instance
window.GameSaveManager = new GameSaveManager();
