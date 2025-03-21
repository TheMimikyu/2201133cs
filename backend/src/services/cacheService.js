import NodeCache from 'node-cache';
import dotenv from 'dotenv';

dotenv.config();

const usersCacheTTL = parseInt(process.env.CACHE_TTL_USERS) || 300; // Default 5 minutes
const postsCacheTTL = parseInt(process.env.CACHE_TTL_POSTS) || 120; // Default 2 minutes

const usersCache = new NodeCache({ stdTTL: usersCacheTTL });
const postsCache = new NodeCache({ stdTTL: postsCacheTTL });

const cacheService = {
  // User caching methods
  getUsers() {
    return usersCache.get('users');
  },
  
  setUsers(users) {
    usersCache.set('users', users);
  },
  
  // Top users caching methods
  getTopUsers() {
    return usersCache.get('topUsers');
  },
  
  setTopUsers(topUsers) {
    usersCache.set('topUsers', topUsers);
  },
  
  // Posts caching methods (for future implementation)
  getUserPosts(userId) {
    return postsCache.get(`user_posts_${userId}`);
  },
  
  setUserPosts(userId, posts) {
    postsCache.set(`user_posts_${userId}`, posts);
  },
  
  clearCache() {
    usersCache.flushAll();
    postsCache.flushAll();
  }
};

export default cacheService;
