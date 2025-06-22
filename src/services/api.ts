import axios from 'axios';

// Determine the base URL based on the environment
const API_URL = import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.PROD
    ? 'https://axep-backend.onrender.com' // Hardcoded backend URL for production
    : 'http://localhost:3001'); // Local development URL

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minute timeout for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging and special handling
api.interceptors.request.use(
  (config) => {
    // Increase timeout for file uploads
    if (config.data instanceof FormData) {
      config.timeout = 300000; // 5 minutes for file uploads
      // Remove Content-Type header for FormData (let browser set it with boundary)
      delete config.headers['Content-Type'];
    }
    
    if (!import.meta.env.PROD) {
      console.log('API Request:', config.method?.toUpperCase(), config.url);
      if (config.data instanceof FormData) {
        console.log('File upload detected, using extended timeout');
      }
    }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging and retry logic
api.interceptors.response.use(
  (response) => {
    if (!import.meta.env.PROD) {
      console.log('API Response:', response.status, response.config.url);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Improved error logging with proper checks
    if (error.response) {
      // Server responded with error status
      console.error('API Response Error:', error.response.status, error.response.data, error.config?.url);
    } else if (error.request) {
      // Request was made but no response received (network error, backend down, etc.)
      console.error('API Network Error: No response received', error.message, error.config?.url);
      console.error('This usually means the backend server is not running or not accessible');
    } else {
      // Something else happened in setting up the request
      console.error('API Request Setup Error:', error.message, error.config?.url);
    }
    
    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out. File might be too large or connection is slow.');
    } else if (error.code === 'ERR_NETWORK') {
      console.error('Network error: Please check if the backend server is running');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused: Backend server is not running on the expected port');
    }
    
    // Retry logic for 502 Bad Gateway and network errors
    if (
      (error.response?.status === 502 || error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') &&
      !originalRequest._retry &&
      originalRequest.method === 'get'
    ) {
      originalRequest._retry = true;
      console.log('Retrying request after error:', originalRequest.url);
      
      // Wait 2 seconds before retrying for network errors
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        return await api(originalRequest);
      } catch (retryError: any) {
        console.error('Retry failed:', retryError.message || retryError);
        return Promise.reject(retryError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 