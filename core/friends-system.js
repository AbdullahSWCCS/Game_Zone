/**
 * Friends System
 * Manages friend relationships, friend requests, and friend activities
 */

class FriendsSystem {
    constructor() {
        this.service = window.GameZoneFirebase;
    }

    /**
     * Send friend request
     */
    async sendFriendRequest(fromUserId, toUserId, toEmail) {
        if (fromUserId === toUserId) throw new Error('Cannot add yourself as friend');

        const requestId = `req_${fromUserId}_${toUserId}_${Date.now()}`;
        const requestData = {
            requestId,
            fromUserId,
            toUserId,
            toEmail,
            status: 'pending',
            createdAt: Date.now(),
            respondedAt: null
        };

        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('friend_requests')
                    .doc(requestId)
                    .set(requestData);
                return requestId;
            } catch (error) {
                console.error('Error sending friend request:', error);
                return this.saveFriendRequestLocal(requestData);
            }
        } else {
            return this.saveFriendRequestLocal(requestData);
        }
    }

    /**
     * Save friend request locally
     */
    saveFriendRequestLocal(requestData) {
        const requests = JSON.parse(localStorage.getItem('gamezone_friend_requests') || '[]');
        requests.push(requestData);
        localStorage.setItem('gamezone_friend_requests', JSON.stringify(requests));
        return requestData.requestId;
    }

    /**
     * Accept friend request
     */
    async acceptFriendRequest(requestId, acceptingUserId, acceptingUserEmail) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('friend_requests')
                    .doc(requestId).get();
                
                if (!snapshot.exists) throw new Error('Request not found');

                const request = snapshot.data();
                
                // Create friendship (bidirectional)
                const friendshipId1 = `friend_${request.fromUserId}_${acceptingUserId}`;
                const friendshipId2 = `friend_${acceptingUserId}_${request.fromUserId}`;

                await Promise.all([
                    this.service.db.collection('friendships').doc(friendshipId1).set({
                        userId: request.fromUserId,
                        friendId: acceptingUserId,
                        friendEmail: acceptingUserEmail,
                        createdAt: Date.now()
                    }),
                    this.service.db.collection('friendships').doc(friendshipId2).set({
                        userId: acceptingUserId,
                        friendId: request.fromUserId,
                        friendEmail: request.toEmail,
                        createdAt: Date.now()
                    }),
                    this.service.db.collection('friend_requests').doc(requestId).update({
                        status: 'accepted',
                        respondedAt: Date.now()
                    })
                ]);

                return true;
            } catch (error) {
                console.error('Error accepting friend request:', error);
                return false;
            }
        } else {
            return this.acceptFriendRequestLocal(requestId, acceptingUserId, acceptingUserEmail);
        }
    }

    /**
     * Accept friend request locally
     */
    acceptFriendRequestLocal(requestId, acceptingUserId, acceptingUserEmail) {
        const requests = JSON.parse(localStorage.getItem('gamezone_friend_requests') || '[]');
        const request = requests.find(r => r.requestId === requestId);
        
        if (request) {
            request.status = 'accepted';
            request.respondedAt = Date.now();
            
            // Add to friendships
            const friendships = JSON.parse(localStorage.getItem('gamezone_friendships') || '[]');
            friendships.push({
                userId: request.fromUserId,
                friendId: acceptingUserId,
                friendEmail: acceptingUserEmail,
                createdAt: Date.now()
            });
            friendships.push({
                userId: acceptingUserId,
                friendId: request.fromUserId,
                friendEmail: request.toEmail,
                createdAt: Date.now()
            });
            
            localStorage.setItem('gamezone_friend_requests', JSON.stringify(requests));
            localStorage.setItem('gamezone_friendships', JSON.stringify(friendships));
            return true;
        }
        return false;
    }

    /**
     * Reject friend request
     */
    async rejectFriendRequest(requestId) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('friend_requests')
                    .doc(requestId)
                    .update({
                        status: 'rejected',
                        respondedAt: Date.now()
                    });
                return true;
            } catch (error) {
                console.error('Error rejecting request:', error);
                return false;
            }
        } else {
            const requests = JSON.parse(localStorage.getItem('gamezone_friend_requests') || '[]');
            const request = requests.find(r => r.requestId === requestId);
            if (request) {
                request.status = 'rejected';
                request.respondedAt = Date.now();
                localStorage.setItem('gamezone_friend_requests', JSON.stringify(requests));
                return true;
            }
            return false;
        }
    }

    /**
     * Get pending friend requests for user
     */
    async getPendingRequests(userId) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('friend_requests')
                    .where('toUserId', '==', userId)
                    .where('status', '==', 'pending')
                    .orderBy('createdAt', 'desc')
                    .get();
                return snapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.error('Error fetching requests:', error);
                return [];
            }
        } else {
            const requests = JSON.parse(localStorage.getItem('gamezone_friend_requests') || '[]');
            return requests.filter(r => r.toUserId === userId && r.status === 'pending')
                .sort((a, b) => b.createdAt - a.createdAt);
        }
    }

    /**
     * Get user's friends list
     */
    async getFriendsList(userId) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('friendships')
                    .where('userId', '==', userId)
                    .orderBy('createdAt', 'desc')
                    .get();
                
                const friends = [];
                for (const doc of snapshot.docs) {
                    const friendData = doc.data();
                    const friendProfile = await this.service.getUserProfile({ uid: friendData.friendId });
                    friends.push({
                        friendId: friendData.friendId,
                        email: friendData.friendEmail,
                        profile: friendProfile,
                        addedAt: friendData.createdAt
                    });
                }
                return friends;
            } catch (error) {
                console.error('Error fetching friends:', error);
                return [];
            }
        } else {
            const friendships = JSON.parse(localStorage.getItem('gamezone_friendships') || '[]');
            return friendships.filter(f => f.userId === userId)
                .sort((a, b) => b.createdAt - a.createdAt);
        }
    }

    /**
     * Get what friend is currently playing
     */
    async getFriendActivity(friendId) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('user_sessions')
                    .where('userId', '==', friendId)
                    .where('status', '==', 'active')
                    .orderBy('createdAt', 'desc')
                    .limit(1)
                    .get();

                if (!snapshot.empty) {
                    return snapshot.docs[0].data();
                }
            } catch (error) {
                console.error('Error fetching friend activity:', error);
            }
        } else {
            const sessions = JSON.parse(localStorage.getItem('gamezone_sessions') || '[]');
            const session = sessions.find(s => s.userId === friendId && s.status === 'active');
            return session || null;
        }
    }

    /**
     * Remove friend
     */
    async removeFriend(userId, friendId) {
        const friendshipId1 = `friend_${userId}_${friendId}`;
        const friendshipId2 = `friend_${friendId}_${userId}`;

        if (this.service.mode === 'firebase') {
            try {
                await Promise.all([
                    this.service.db.collection('friendships').doc(friendshipId1).delete(),
                    this.service.db.collection('friendships').doc(friendshipId2).delete()
                ]);
                return true;
            } catch (error) {
                console.error('Error removing friend:', error);
                return false;
            }
        } else {
            let friendships = JSON.parse(localStorage.getItem('gamezone_friendships') || '[]');
            friendships = friendships.filter(f => 
                !((f.userId === userId && f.friendId === friendId) || 
                  (f.userId === friendId && f.friendId === userId))
            );
            localStorage.setItem('gamezone_friendships', JSON.stringify(friendships));
            return true;
        }
    }

    /**
     * Block user
     */
    async blockUser(userId, blockedUserId) {
        if (this.service.mode === 'firebase') {
            try {
                await this.service.db.collection('blocked_users')
                    .doc(`block_${userId}_${blockedUserId}`)
                    .set({
                        userId,
                        blockedUserId,
                        blockedAt: Date.now()
                    });
                
                // Also remove from friends if they are friends
                await this.removeFriend(userId, blockedUserId);
                return true;
            } catch (error) {
                console.error('Error blocking user:', error);
                return false;
            }
        } else {
            const blocked = JSON.parse(localStorage.getItem('gamezone_blocked_users') || '[]');
            blocked.push({
                userId,
                blockedUserId,
                blockedAt: Date.now()
            });
            localStorage.setItem('gamezone_blocked_users', JSON.stringify(blocked));
            return true;
        }
    }

    /**
     * Get blocked users list
     */
    async getBlockedUsers(userId) {
        if (this.service.mode === 'firebase') {
            try {
                const snapshot = await this.service.db.collection('blocked_users')
                    .where('userId', '==', userId)
                    .get();
                return snapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.error('Error fetching blocked users:', error);
                return [];
            }
        } else {
            const blocked = JSON.parse(localStorage.getItem('gamezone_blocked_users') || '[]');
            return blocked.filter(b => b.userId === userId);
        }
    }
}

// Create global instance
window.FriendsSystem = new FriendsSystem();
