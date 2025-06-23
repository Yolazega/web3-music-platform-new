import axios from 'axios';

// Determine the base URL based on the environment
const API_URL = import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.PROD
    ? 'https://axep-backend-production.up.railway.app' // Updated Railway backend URL
    : 'http://localhost:3001'); // Local development URL

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minute timeout for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Wake up the backend if it's sleeping (Render free tier issue)
const wakeUpBackend = async (): Promise<boolean> => {
  try {
    console.log('🔄 Waking up backend server...');
    const response = await axios.get(`${API_URL}/wake`, { timeout: 30000 });
    console.log('✅ Backend is awake:', response.data.message);
    return true;
  } catch (error) {
    console.error('❌ Failed to wake up backend:', error);
    return false;
  }
};

// Check if backend is healthy
const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${API_URL}/health`, { timeout: 10000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// Enhanced retry mechanism with backend wake-up
const retryWithWakeup = async (originalRequest: any, maxRetries: number = 3): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for ${originalRequest.url}`);
      
      // Try to wake up backend on first retry
      if (attempt === 1) {
        await wakeUpBackend();
        // Wait for backend to fully wake up
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        // Shorter wait for subsequent retries
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const response = await api(originalRequest);
      console.log(`✅ Retry ${attempt} successful for ${originalRequest.url}`);
      return response;
    } catch (retryError: any) {
      console.error(`❌ Retry ${attempt} failed:`, retryError.message);
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        throw retryError;
      }
    }
  }
};

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
    
    // Enhanced retry logic for various error scenarios
    const shouldRetry = (
      // 502 Bad Gateway (backend sleeping)
      error.response?.status === 502 ||
      // 503 Service Unavailable (backend overloaded)
      error.response?.status === 503 ||
      // Network errors
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNABORTED'
    );
    
    if (shouldRetry && !originalRequest._retry && originalRequest.method?.toLowerCase() === 'get') {
      originalRequest._retry = true;
      
      try {
        return await retryWithWakeup(originalRequest);
      } catch (retryError: any) {
        console.error('All retry attempts failed:', retryError.message || retryError);
        return Promise.reject(retryError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Export additional utility functions
export { wakeUpBackend, checkBackendHealth };
export default api; 