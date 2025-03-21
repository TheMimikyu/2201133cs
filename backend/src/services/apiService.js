import axios from 'axios';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import schedule from 'node-schedule';

dotenv.config();

const BASE_URL = process.env.TEST_SERVER_URL;
const authCache = new NodeCache();

const authData = {
  companyName: "goMart", 
  clientID: "eaf55302-26b8-47b6-9a9c-eaf8f9eb5fe9", 
  clientSecret: "XsLvEzTzyjMOIGtY", 
  ownerName: "Vedant Yadav", 
  ownerEmail: "vedant.2201133cs@iiitbh.ac.in", 
  rollNo: "2201133cs"
};

const apiService = {
  async authenticate() {
    try {
      const response = await axios.post(`${BASE_URL}/auth`, authData);
      const { access_token, token_type, expires_in } = response.data;
      
      const token = `${token_type} ${access_token}`;
      authCache.set('authToken', token);
      
      console.log('Authentication successful');
      
      // Schedule token refresh before expiration
      schedule.scheduleJob(new Date(Date.now() + (expires_in - 300) * 1000), this.authenticate.bind(this));
      
      return token;
    } catch (error) {
      console.error('Authentication error:', error.message);
      throw error;
    }
  },

  async getAuthToken() {
    let token = authCache.get('authToken');
    if (!token) {
      token = await this.authenticate();
    }
    return token;
  },

  async fetchUsers() {
    try {
      const token = await this.getAuthToken();
      const response = await axios.get(`${BASE_URL}/users`, {
        headers: { Authorization: token }
      });
      return response.data.users;
    } catch (error) {
      console.error('Error fetching users:', error.message);
      throw error;
    }
  },

  // New method to fetch posts for a specific user
  async fetchUserPosts(userId) {
    try {
      const token = await this.getAuthToken();
      const response = await axios.get(`${BASE_URL}/users/${userId}/posts`, {
        headers: { Authorization: token }
      });
      return response.data.posts;
    } catch (error) {
      console.error(`Error fetching posts for user ${userId}:`, error.message);
      return [];  // Return empty array in case of error
    }
  },
  
  // New method to fetch comments for a post
  async fetchPostComments(postId) {
    try {
      const token = await this.getAuthToken();
      const response = await axios.get(`${BASE_URL}/posts/${postId}/comments`, {
        headers: { Authorization: token }
      });
      return response.data.comments;
    } catch (error) {
      console.error(`Error fetching comments for post ${postId}:`, error.message);
      return [];
    }
  },

  async getTopUsers() {
    const users = await this.fetchUsers();
    const userWithPosts = [];
    
    // Fetch actual post count for each user
    for (const [id, name] of Object.entries(users)) {
      const posts = await this.fetchUserPosts(id);
      userWithPosts.push({
        id,
        name,
        postCount: posts.length  // Use actual count instead of random number
      });
    }
    
    // Use a min-heap to find top 5 users by post count
    const heap = new MinHeap();
    
    userWithPosts.forEach(user => {
      heap.insert(user);
      if (heap.size() > 5) {
        heap.extractMin();
      }
    });
    
    // Extract users from heap in descending order of post count
    const topUsers = [];
    while (heap.size() > 0) {
      topUsers.unshift(heap.extractMin());
    }
    
    return topUsers;
  },

  // New method to fetch all posts from all users
  async fetchAllPosts() {
    try {
      const users = await this.fetchUsers();
      let allPosts = [];
      
      // Fetch posts for each user
      for (const userId of Object.keys(users)) {
        const userPosts = await this.fetchUserPosts(userId);
        allPosts = allPosts.concat(userPosts.map(post => ({
          ...post,
          username: users[userId]
        })));
      }
      
      return allPosts;
    } catch (error) {
      console.error('Error fetching all posts:', error.message);
      return [];
    }
  },

  // Method to get the latest 5 posts using max heap
  async getLatestPosts() {
    try {
      const allPosts = await this.fetchAllPosts();
      
      // Use max heap to efficiently find the latest 5 posts
      const maxHeap = new MaxHeap((post) => post.id);
      
      for (const post of allPosts) {
        maxHeap.insert(post);
      }
      
      // Extract the 5 posts with highest IDs (latest posts)
      const latestPosts = [];
      const extractCount = Math.min(5, maxHeap.size());
      
      for (let i = 0; i < extractCount; i++) {
        latestPosts.push(maxHeap.extractMax());
      }
      
      return latestPosts;
    } catch (error) {
      console.error('Error getting latest posts:', error.message);
      return [];
    }
  },

  // Method to get popular posts (with most comments) using heap
  async getPopularPosts() {
    try {
      const allPosts = await this.fetchAllPosts();
      
      // Create a priority queue to track posts by comment count
      const commentHeap = new MaxHeap((post) => post.commentCount);
      
      // Process posts in batches to avoid memory issues
      for (const post of allPosts) {
        const comments = await this.fetchPostComments(post.id);
        const postWithComments = {
          ...post,
          commentCount: comments.length
        };
        commentHeap.insert(postWithComments);
      }
      
      // If there are no posts, return empty array
      if (commentHeap.size() === 0) {
        return [];
      }
      
      // Get the highest comment count
      const topPost = commentHeap.peek();
      const maxComments = topPost.commentCount;
      
      // Extract all posts that have this max comment count
      const mostCommentedPosts = [];
      while (commentHeap.size() > 0 && commentHeap.peek().commentCount === maxComments) {
        mostCommentedPosts.push(commentHeap.extractMax());
      }
      
      // Sort by newest first within the group
      return mostCommentedPosts.sort((a, b) => b.id - a.id);
    } catch (error) {
      console.error('Error getting popular posts:', error.message);
      return [];
    }
  }
};

// Min-heap implementation for finding top users
class MinHeap {
  constructor() {
    this.heap = [];
  }
  
  size() {
    return this.heap.length;
  }
  
  getParentIndex(index) {
    return Math.floor((index - 1) / 2);
  }
  
  getLeftChildIndex(index) {
    return 2 * index + 1;
  }
  
  getRightChildIndex(index) {
    return 2 * index + 2;
  }
  
  swap(index1, index2) {
    [this.heap[index1], this.heap[index2]] = [this.heap[index2], this.heap[index1]];
  }
  
  insert(user) {
    this.heap.push(user);
    this.heapifyUp(this.heap.length - 1);
  }
  
  heapifyUp(index) {
    let currentIndex = index;
    let parentIndex = this.getParentIndex(currentIndex);
    
    while (
      currentIndex > 0 &&
      this.heap[parentIndex].postCount > this.heap[currentIndex].postCount
    ) {
      this.swap(currentIndex, parentIndex);
      currentIndex = parentIndex;
      parentIndex = this.getParentIndex(currentIndex);
    }
  }
  
  extractMin() {
    if (this.heap.length === 0) return null;
    
    const min = this.heap[0];
    const last = this.heap.pop();
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.heapifyDown(0);
    }
    
    return min;
  }
  
  heapifyDown(index) {
    let smallest = index;
    const leftChildIndex = this.getLeftChildIndex(index);
    const rightChildIndex = this.getRightChildIndex(index);
    const size = this.heap.length;
    
    if (
      leftChildIndex < size &&
      this.heap[leftChildIndex].postCount < this.heap[smallest].postCount
    ) {
      smallest = leftChildIndex;
    }
    
    if (
      rightChildIndex < size &&
      this.heap[rightChildIndex].postCount < this.heap[smallest].postCount
    ) {
      smallest = rightChildIndex;
    }
    
    if (smallest !== index) {
      this.swap(index, smallest);
      this.heapifyDown(smallest);
    }
  }
}

// Max-heap implementation for finding latest/popular posts
class MaxHeap {
  constructor(keyFunction = (item) => item) {
    this.heap = [];
    this.keyFunction = keyFunction;
  }
  
  size() {
    return this.heap.length;
  }
  
  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }
  
  getParentIndex(index) {
    return Math.floor((index - 1) / 2);
  }
  
  getLeftChildIndex(index) {
    return 2 * index + 1;
  }
  
  getRightChildIndex(index) {
    return 2 * index + 2;
  }
  
  swap(index1, index2) {
    [this.heap[index1], this.heap[index2]] = [this.heap[index2], this.heap[index1]];
  }
  
  insert(item) {
    this.heap.push(item);
    this.heapifyUp(this.heap.length - 1);
  }
  
  heapifyUp(index) {
    let currentIndex = index;
    let parentIndex = this.getParentIndex(currentIndex);
    
    while (
      currentIndex > 0 &&
      this.keyFunction(this.heap[parentIndex]) < this.keyFunction(this.heap[currentIndex])
    ) {
      this.swap(currentIndex, parentIndex);
      currentIndex = parentIndex;
      parentIndex = this.getParentIndex(currentIndex);
    }
  }
  
  extractMax() {
    if (this.heap.length === 0) return null;
    
    const max = this.heap[0];
    const last = this.heap.pop();
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.heapifyDown(0);
    }
    
    return max;
  }
  
  heapifyDown(index) {
    let largest = index;
    const leftChildIndex = this.getLeftChildIndex(index);
    const rightChildIndex = this.getRightChildIndex(index);
    const size = this.heap.length;
    
    if (
      leftChildIndex < size &&
      this.keyFunction(this.heap[leftChildIndex]) > this.keyFunction(this.heap[largest])
    ) {
      largest = leftChildIndex;
    }
    
    if (
      rightChildIndex < size &&
      this.keyFunction(this.heap[rightChildIndex]) > this.keyFunction(this.heap[largest])
    ) {
      largest = rightChildIndex;
    }
    
    if (largest !== index) {
      this.swap(index, largest);
      this.heapifyDown(largest);
    }
  }
}

export default apiService;
