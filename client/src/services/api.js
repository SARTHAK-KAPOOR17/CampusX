// client/src/services/api.js
import axios from 'axios';

// Base API URL from Vite environment variable (defaults to localhost:5000)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const AI_SERVICE_BASE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const aiClient = axios.create({
  baseURL: AI_SERVICE_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to unwrap standard response envelope
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.message || 'Network request failed',
      statusCode: error.response?.status || 500,
      details: error.response?.data?.errors || null,
    };
    return Promise.reject(customError);
  }
);

export const checkServerHealth = () => apiClient.get('/api/health');
export const checkAiHealth = () => aiClient.get('/health');
