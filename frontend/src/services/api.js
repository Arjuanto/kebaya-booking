import axios from 'axios';

// Base URL dibaca dari environment variable sesuai kriteria Issue #24
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Pasang Bearer Token untuk request admin
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Format error terpusat
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const responseData = error.response?.data;
    return Promise.reject(responseData || {
      status: 'error',
      code: 'NETWORK_ERROR',
      message: 'Tidak dapat terhubung ke server backend.',
    });
  }
);

export default apiClient;
export { API_BASE_URL };
