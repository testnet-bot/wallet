import axios, {
  AxiosInstance,
  AxiosResponse,
  AxiosRequestHeaders,
  InternalAxiosRequestConfig
} from "axios";

// ─── SAFELY DETERMINE BASE_URL ─────────────────────────────
let BASE_URL = "http://localhost:4000/api";

try {
  // Node / Jest environment fallback
  if (typeof process !== "undefined" && process.env?.VITE_API_BASE) {
    BASE_URL = process.env.VITE_API_BASE;
  }
  // Browser / Vite environment
  else if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    BASE_URL = import.meta.env.VITE_API_BASE;
  }
} catch (e) {
  console.warn("BASE_URL fallback used:", BASE_URL);
}

// ─── AXIOS INSTANCE ─────────────────────────────
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── REQUEST INTERCEPTOR ────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("walletAuthToken");
        if (token) {
          // SAFE: ensure headers object exists and keeps correct type
          if (!config.headers) config.headers = {} as AxiosRequestHeaders;
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch (err) {
      console.warn("Token read failed:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── RESPONSE INTERCEPTOR ───────────────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    console.error(
      "API call failed:",
      error?.response?.data || error?.message || error
    );
    return Promise.reject(error);
  }
);

export default apiClient;
