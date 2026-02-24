import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_URL?.trim() || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

// send credentials (refresh cookie) with requests by default
api.defaults.withCredentials = true;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// response interceptor to handle 401 -> try refresh token flow
let isRefreshing = false;
let refreshQueue = [];
const processQueue = (error, token = null) => {
  refreshQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  refreshQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    if (err.response && err.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((e) => Promise.reject(e));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        // call refresh endpoint using plain axios to avoid interceptor loops
        const r = await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
        const newToken = r.data.token;
        localStorage.setItem('token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        processQueue(null, newToken);
        isRefreshing = false;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        // failed to refresh — clear local session
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(err);
  }
);
