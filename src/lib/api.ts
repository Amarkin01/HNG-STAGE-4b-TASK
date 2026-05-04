import axios from 'axios';

const api = axios.create({
    baseURL: 'https://whisperbox.koyeb.app',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('whisper_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;