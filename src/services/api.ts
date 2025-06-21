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
    
    console.error('API Response Error:', error.response?.status, error.response?.data, error.config?.url);
    
    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out. File might be too large or connection is slow.');
    }
    
    // Retry logic for 502 Bad Gateway and network errors
    if (
      (error.response?.status === 502 || error.code === 'ERR_NETWORK') &&
      !originalRequest._retry &&
      originalRequest.method === 'get'
    ) {
      originalRequest._retry = true;
      console.log('Retrying request after 502/network error:', originalRequest.url);
      
      // Wait 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        return await api(originalRequest);
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        return Promise.reject(retryError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 