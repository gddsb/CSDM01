import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const baseURL = Constants?.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3001/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
    }
    const message = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject({ ...error, message });
  }
);

export default api;
