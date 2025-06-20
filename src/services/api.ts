import axios from 'axios';

// Determine the base URL based on the environment
const API_URL = import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.PROD
    ? 'https://axep-backend.onrender.com' // Hardcoded backend URL for production
    : 'http://localhost:3001'); // Local development URL

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging (only in development)
api.interceptors.request.use(
  (config) => {
    if (!import.meta.env.PROD) {
      console.log('API Request:', config.method?.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging (only in development)
api.interceptors.response.use(
  (response) => {
    if (!import.meta.env.PROD) {
      console.log('API Response:', response.status, response.config.url);
    }
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

export default api; 