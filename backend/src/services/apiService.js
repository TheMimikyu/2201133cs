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

export default apiService;
