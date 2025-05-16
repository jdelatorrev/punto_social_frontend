// js/api.js

// 📌 Detectar entorno (local o producción)
const API = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:3000"
  : "backend_punto_social.railway.internal";

// 📌 Obtener token de LocalStorage
function getToken() {
  return localStorage.getItem("token");
}

// 📌 Obtener payload del token JWT
function getPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Token inválido:", e);
    return null;
  }
}

// 📌 Verificar si token es válido
function isTokenValido() {
  const payload = getPayload();
  if (!payload) return false;
  const ahora = Math.floor(Date.now() / 1000);
  return payload.exp > ahora;
}

// 🔒 Escape HTML para evitar XSS
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, function (m) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[m];
  });
}

// 📌 Hacer peticiones a la API
async function apiFetch(endpoint, options = {}) {
  const { auth = true, timeout = 15000 } = options; // timeout default: 15 segundos
  const token = getToken();
  const headers = options.headers || {};

  if (auth && token) headers["Authorization"] = `Bearer ${token}`;
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // 📌 Implementar timeout
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API}${endpoint}`, {
      credentials: "include",
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(id);

    const contentType = res.headers.get("content-type");
    const raw = await res.text();

    const data = contentType?.includes("application/json") ? JSON.parse(raw) : {};

    if (!res.ok) throw new Error(data.error || "Error desconocido");

    return data;

  } catch (err) {
    clearTimeout(id);

    if (err.name === "AbortError") {
      console.error("⛔ Petición abortada por timeout");
      throw new Error("La solicitud ha tardado demasiado");
    }

    console.error("⛔ Error en la petición:", err);
    throw err;
  }
}

// 📦 Exportar funciones globalmente para uso en todo el frontend
window.api = {
  API,
  getToken,
  getPayload,
  isTokenValido,
  apiFetch,
  escapeHTML
};
