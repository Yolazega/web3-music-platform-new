import axios from 'axios';

// Determine the base URL based on the environment
const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://web3-music-backend.onrender.com' // Your deployed backend URL
  : 'http://localhost:3001'; // Your local backend URL

const api = axios.create({
  baseURL: API_URL,
});

export default api; 