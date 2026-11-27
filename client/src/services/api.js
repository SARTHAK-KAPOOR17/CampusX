// client/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const AI_SERVICE_BASE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
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

let authHandlers = {
  getAccessToken: () => null,
  onRefreshSuccess: () => {},
  onRefreshFailure: () => {},
};

export const configureAuthHandlers = (handlers) => {
  authHandlers = { ...authHandlers, ...handlers };
};

let activeRefreshPromise = null;

/**
 * Deduplicated silent refresh call (prevents concurrent rotation collisions).
 */
export const performRefresh = async () => {
  if (!activeRefreshPromise) {
    activeRefreshPromise = apiClient
      .post('/api/auth/refresh')
      .then((res) => {
        const payload = res?.data;
        if (payload?.accessToken && payload?.user) {
          authHandlers.onRefreshSuccess(payload);
          return payload;
        }
        throw new Error('Invalid refresh response');
      })
      .finally(() => {
        activeRefreshPromise = null;
      });
  }
  return activeRefreshPromise;
};

// Attach in-memory access token to outgoing requests
apiClient.interceptors.request.use(
  (config) => {
    const token = authHandlers.getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const AUTH_SKIP_RETRY_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/auth/logout',
];

// Response interceptor: unwrap standard response envelope & handle 401 token refresh once
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url || '';

    const shouldSkipRetry = AUTH_SKIP_RETRY_PATHS.some((path) => requestUrl.includes(path));

    if (status === 401 && originalRequest && !originalRequest._retry && !shouldSkipRetry) {
      originalRequest._retry = true;
      try {
        const refreshed = await performRefresh();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        authHandlers.onRefreshFailure();
        const customRefreshErr = {
          message: refreshError?.message || 'Session expired. Please log in again.',
          statusCode: refreshError?.statusCode || 401,
          details: refreshError?.details || null,
        };
        return Promise.reject(customRefreshErr);
      }
    }

    const customError = {
      message: error.response?.data?.message || error.message || 'Network request failed',
      statusCode: error.response?.status || 500,
      details: error.response?.data?.errors || null,
    };
    return Promise.reject(customError);
  }
);

export const resolveAssetUrl = (assetPath) => {
  if (!assetPath) return null;
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('blob:')) {
    return assetPath;
  }
  return `${API_BASE_URL}${assetPath}`;
};

export const checkServerHealth = () => apiClient.get('/api/health');
export const checkAiHealth = () => aiClient.get('/health');
export const authApi = {
  signup: (data) => apiClient.post('/api/auth/signup', data),
  login: (data) => apiClient.post('/api/auth/login', data),
  refresh: () => performRefresh(),
  logout: () => apiClient.post('/api/auth/logout'),
  logoutAll: () => apiClient.post('/api/auth/logout-all'),
  me: () => apiClient.get('/api/auth/me'),
};

export const verificationApi = {
  requestOtp: (collegeEmail) => apiClient.post('/api/verification/request', { collegeEmail }),
  confirmOtp: (otp) => apiClient.post('/api/verification/confirm', { otp }),
  getStatus: () => apiClient.get('/api/verification/status'),
};

export const usersApi = {
  getMyProfile: () => apiClient.get('/api/users/me/profile'),
  updateMyProfile: (data) => apiClient.patch('/api/users/me/profile', data),
  uploadAvatar: (formData) =>
    apiClient.post('/api/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getPublicProfile: (id) => apiClient.get(`/api/users/${id}`),
};

export const categoriesApi = {
  list: () => apiClient.get('/api/categories'),
};

export const productsApi = {
  list: (params = {}) => apiClient.get('/api/products', { params }),
  mine: (params = {}) => apiClient.get('/api/products/mine', { params }),
  getById: (id) => apiClient.get(`/api/products/${id}`),
  create: (data) => apiClient.post('/api/products', data),
  update: (id, data) => apiClient.patch(`/api/products/${id}`, data),
  publish: (id) => apiClient.post(`/api/products/${id}/publish`),
  updateStatus: (id, status) => apiClient.post(`/api/products/${id}/status`, { status }),
  remove: (id) => apiClient.delete(`/api/products/${id}`),
  uploadImages: (id, formData, onUploadProgress) =>
    apiClient.post(`/api/products/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
      onUploadProgress,
    }),
  deleteImage: (id, imageId) => apiClient.delete(`/api/products/${id}/images/${imageId}`),
  reorderImages: (id, imageIds) =>
    apiClient.patch(`/api/products/${id}/images/order`, { imageIds }),
};
