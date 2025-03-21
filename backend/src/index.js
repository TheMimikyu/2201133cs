import dotenv from 'dotenv'; 
import express from 'express';
import cors from 'cors';

import apiService from './services/apiService.js';
import cacheService from './services/cacheService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize authentication
(async () => {
  try {
    await apiService.authenticate();
    console.log('Initial authentication completed');
  } catch (error) {
    console.error('Failed to initialize authentication:', error);
  }
})();

// API Endpoints
app.get('/users', async (req, res) => {
  try {
    // Check cache first
    const cachedUsers = cacheService.getTopUsers();
    if (cachedUsers) {
      return res.json(cachedUsers);
    }
    
    // If not in cache, fetch from API
    const topUsers = await apiService.getTopUsers();
    
    // Store in cache for future requests
    cacheService.setTopUsers(topUsers);
    
    res.json(topUsers);
  } catch (error) {
    console.error('Error in /users endpoint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});