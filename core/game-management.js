/**
 * Game Management System
 * Manages game CRUD operations, uploads, and metadata
 */

class GameManagementSystem {
    constructor() {
        this.service = window.GameZoneFirebase;
    }

    /**
     * Add a new game to the platform
     */
    async addGame(gameData) {
        if (!gameData.name || !gameData.category) {
            throw new Error('Game name and category are required');
        }

        const gameId = `game_${Date.now()}`;
        const gameEntry = {
            gameId,
            name: gameData.name,
            category: gameData.category,
            emoji: gameData.emoji || '🎮',
            link: gameData.link || '',
            description: gameData.description || '',
            author: gameData.author || 'Unknown',
            isOnline: gameData.isOnline || false,
            isDownloadable: gameData.isDownloadable || false,
            downloadUrl: gameData.downloadUrl || '',
            downloadSize: gameData.downloadSize || 0,
            imageUrl: gameData.imageUrl || '',
            rating: 0,
            downloads: 0,
            plays: 0,
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('games')
                    .doc(gameId)
                    .set(gameEntry);
                return gameId;
            } catch (error) {
                console.error('Error adding game to Firebase:', error);
                return this.addGameLocal(gameEntry);
            }
        } else {
            return this.addGameLocal(gameEntry);
        }
    }

    /**
     * Add game locally
     */
    addGameLocal(gameEntry) {
        const games = JSON.parse(localStorage.getItem('gamezone_games_library') || '[]');
        games.push(gameEntry);
        localStorage.setItem('gamezone_games_library', JSON.stringify(games));
        return gameEntry.gameId;
    }

    /**
     * Update game information
     */
    async updateGame(gameId, updateData) {
        const updatePayload = {
            ...updateData,
            updatedAt: Date.now()
        };

        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('games')
                    .doc(gameId)
                    .update(updatePayload);
                return true;
            } catch (error) {
                console.error('Error updating game:', error);
                return this.updateGameLocal(gameId, updatePayload);
            }
        } else {
            return this.updateGameLocal(gameId, updatePayload);
        }
    }

    /**
     * Update game locally
     */
    updateGameLocal(gameId, updateData) {
        const games = JSON.parse(localStorage.getItem('gamezone_games_library') || '[]');
        const gameIndex = games.findIndex(g => g.gameId === gameId);
        if (gameIndex >= 0) {
            games[gameIndex] = { ...games[gameIndex], ...updateData };
            localStorage.setItem('gamezone_games_library', JSON.stringify(games));
            return true;
        }
        return false;
    }

    /**
     * Delete game
     */
    async deleteGame(gameId) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('games').doc(gameId).delete();
                return true;
            } catch (error) {
                console.error('Error deleting game:', error);
                return this.deleteGameLocal(gameId);
            }
        } else {
            return this.deleteGameLocal(gameId);
        }
    }

    /**
     * Delete game locally
     */
    deleteGameLocal(gameId) {
        let games = JSON.parse(localStorage.getItem('gamezone_games_library') || '[]');
        games = games.filter(g => g.gameId !== gameId);
        localStorage.setItem('gamezone_games_library', JSON.stringify(games));
        return true;
    }

    /**
     * Get game by ID
     */
    async getGame(gameId) {
        if (this.service.mode === 'firebase') {
            try {
                const doc = await this.service.db.collection('games').doc(gameId).get();
                return doc.exists ? doc.data() : null;
            } catch (error) {
                console.error('Error fetching game:', error);
                return this.getGameLocal(gameId);
            }
        } else {
            return this.getGameLocal(gameId);
        }
    }

    /**
     * Get game locally
     */
    getGameLocal(gameId) {
        const games = JSON.parse(localStorage.getItem('gamezone_games_library') || '[]');
        return games.find(g => g.gameId === gameId) || null;
    }

    /**
     * Get all games
     */
    async getAllGames(filters = {}) {
        if (this.service.mode === 'firebase') {
            try {
                let query = this.service.db.collection('games')
                    .where('status', '==', 'active');

                if (filters.category) {
                    query = query.where('category', '==', filters.category);
                }

                if (filters.isOnline !== undefined) {
                    query = query.where('isOnline', '==', filters.isOnline);
                }

                if (filters.isDownloadable !== undefined) {
                    query = query.where('isDownloadable', '==', filters.isDownloadable);
                }

                query = query.orderBy(filters.sortBy || 'createdAt', 'desc');

                if (filters.limit) {
                    query = query.limit(filters.limit);
                }

                const snapshot = await query.get();
                return snapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.error('Error fetching games:', error);
                return this.getAllGamesLocal(filters);
            }
        } else {
            return this.getAllGamesLocal(filters);
        }
    }

    /**
     * Get all games locally
     */
    getAllGamesLocal(filters = {}) {
        let games = JSON.parse(localStorage.getItem('gamezone_games_library') || '[]');
        games = games.filter(g => g.status === 'active');

        if (filters.category) {
            games = games.filter(g => g.category === filters.category);
        }

        if (filters.isOnline !== undefined) {
            games = games.filter(g => g.isOnline === filters.isOnline);
        }

        if (filters.isDownloadable !== undefined) {
            games = games.filter(g => g.isDownloadable === filters.isDownloadable);
        }

        const sortBy = filters.sortBy || 'createdAt';
        games.sort((a, b) => b[sortBy] - a[sortBy]);

        if (filters.limit) {
            games = games.slice(0, filters.limit);
        }

        return games;
    }

    /**
     * Record game play
     */
    async recordGamePlay(userId, gameId) {
        if (this.service.mode === 'firebase') {
            try {
                await Promise.all([
                    this.service.db.collection('games').doc(gameId)
                        .update({
                            plays: firebase.firestore.FieldValue.increment(1),
                            lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }),
                    this.service.db.collection('game_stats')
                        .doc(`${userId}_${gameId}`)
                        .set({
                            userId,
                            gameId,
                            playCount: firebase.firestore.FieldValue.increment(1),
                            lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true })
                ]);
            } catch (error) {
                console.error('Error recording game play:', error);
            }
        }
    }

    /**
     * Record game download
     */
    async recordGameDownload(userId, gameId) {
        if (this.service.mode === 'firebase') {
            try {
                await Promise.all([
                    this.service.db.collection('games').doc(gameId)
                        .update({
                            downloads: firebase.firestore.FieldValue.increment(1)
                        }),
                    this.service.db.collection('user_downloads')
                        .doc(`${userId}_${gameId}`)
                        .set({
                            userId,
                            gameId,
                            downloadedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true })
                ]);
            } catch (error) {
                console.error('Error recording download:', error);
            }
        }
    }

    /**
     * Add game review/rating
     */
    async addGameReview(userId, gameId, rating, review = '') {
        const reviewId = `review_${userId}_${gameId}_${Date.now()}`;
        
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('game_reviews')
                    .doc(reviewId)
                    .set({
                        reviewId,
                        userId,
                        gameId,
                        rating: Math.min(5, Math.max(1, rating)),
                        review,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                // Update game average rating
                await this.updateGameRating(gameId);
                return reviewId;
            } catch (error) {
                console.error('Error adding review:', error);
                return null;
            }
        } else {
            const reviews = JSON.parse(localStorage.getItem('gamezone_reviews') || '[]');
            reviews.push({
                reviewId,
                userId,
                gameId,
                rating: Math.min(5, Math.max(1, rating)),
                review,
                createdAt: Date.now()
            });
            localStorage.setItem('gamezone_reviews', JSON.stringify(reviews));
            return reviewId;
        }
    }

    /**
     * Get game reviews
     */
    async getGameReviews(gameId) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('game_reviews')
                    .where('gameId', '==', gameId)
                    .orderBy('createdAt', 'desc')
                    .get();
                return snapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.error('Error fetching reviews:', error);
                return [];
            }
        } else {
            const reviews = JSON.parse(localStorage.getItem('gamezone_reviews') || '[]');
            return reviews.filter(r => r.gameId === gameId)
                .sort((a, b) => b.createdAt - a.createdAt);
        }
    }

    /**
     * Update game rating
     */
    async updateGameRating(gameId) {
        const reviews = await this.getGameReviews(gameId);
        if (reviews.length === 0) return;

        const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        
        await this.updateGame(gameId, {
            rating: parseFloat(averageRating.toFixed(1)),
            reviewCount: reviews.length
        });
    }

    /**
     * Search games
     */
    async searchGames(query, limit = 20) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('games')
                    .where('status', '==', 'active')
                    .limit(limit * 2)
                    .get();

                const allGames = snapshot.docs.map(doc => doc.data());
                const queryLower = query.toLowerCase();

                return allGames.filter(game =>
                    game.name.toLowerCase().includes(queryLower) ||
                    game.description.toLowerCase().includes(queryLower) ||
                    game.category.toLowerCase().includes(queryLower)
                ).slice(0, limit);
            } catch (error) {
                console.error('Error searching games:', error);
                return this.searchGamesLocal(query, limit);
            }
        } else {
            return this.searchGamesLocal(query, limit);
        }
    }

    /**
     * Search games locally
     */
    searchGamesLocal(query, limit = 20) {
        const games = JSON.parse(localStorage.getItem('gamezone_games_library') || '[]');
        const queryLower = query.toLowerCase();

        return games.filter(game =>
            game.name.toLowerCase().includes(queryLower) ||
            game.description.toLowerCase().includes(queryLower) ||
            game.category.toLowerCase().includes(queryLower)
        ).slice(0, limit);
    }

    /**
     * Get trending games
     */
    async getTrendingGames(limit = 10) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('games')
                    .where('status', '==', 'active')
                    .orderBy('plays', 'desc')
                    .limit(limit)
                    .get();
                return snapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.error('Error fetching trending games:', error);
                return [];
            }
        } else {
            const games = JSON.parse(localStorage.getItem('gamezone_games_library') || '[]');
            return games.filter(g => g.status === 'active')
                .sort((a, b) => (b.plays || 0) - (a.plays || 0))
                .slice(0, limit);
        }
    }
}

// Create global instance
window.GameManagementSystem = new GameManagementSystem();
