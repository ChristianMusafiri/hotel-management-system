import axios from 'axios';

// Configuration de l'URL de base du backend NestJS
const API_URL = 'http://localhost:3000'; // port actuel NestJS 

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// L'intercepteur de Requête : Injecte automatiquement le JWT
api.interceptors.request.use(
  (config) => {
    // Récupération du token stocké localement dans le navigateur
    const token = localStorage.getItem('hotel_token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// L'intercepteur de Réponse : Gère les erreurs globales (ex: Token expiré)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si le backend renvoie 401 (Unauthorized), l'utilisateur doit se reconnecter
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('hotel_token');
      localStorage.removeItem('user_roles');
      // Redirection vers le login si nécessaire (fenêtre globale)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;