// storage.js
// Local-only encrypted storage for alt sessions
// Uses Web Crypto AES-GCM. Works in modern Electron / browser contexts.

const STORAGE_KEY = "revenge_alt_manager_v1";
const SALT_KEY = "revenge_alt_manager_salt_v1";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function unb64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

function uuid() {
  return crypto.randomUUID();
}

async function getSalt() {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    const raw = crypto.getRandomValues(new Uint8Array(16));
    salt = b64(raw);
    localStorage.setItem(SALT_KEY, salt);
  }
  return unb64(salt);
}

async function deriveKey(password) {
  const salt = await getSalt();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 150000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptJSON(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data))
  );

  return {
    iv: b64(iv),
    data: b64(ct)
  };
}

async function decryptJSON(key, payload) {
  const iv = unb64(payload.iv);
  const data = unb64(payload.data);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return JSON.parse(dec.decode(pt));
}

// --- public API ---
export async function initStore(password) {
  const key = await deriveKey(password);
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const empty = await encryptJSON(key, { alts: [] });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  }
  return key;
}

export async function loadStore(key) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { alts: [] };
  return decryptJSON(key, JSON.parse(raw));
}

export async function saveStore(key, store) {
  const encStore = await encryptJSON(key, store);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encStore));
}

export async function addAlt(key, name, sessionBlob) {
  const store = await loadStore(key);
  store.alts.push({
    id: uuid(),
    name,
    session: sessionBlob,
    created: Date.now()
  });
  await saveStore(key, store);
}

export async function removeAlt(key, id) {
  const store = await loadStore(key);
  store.alts = store.alts.filter(a => a.id !== id);
  await saveStore(key, store);
}

export async function listAlts(key) {
  const store = await loadStore(key);
  return store.alts.map(({ id, name, created }) => ({ id, name, created }));
}

export async function getAltSession(key, id) {
  const store = await loadStore(key);
  const alt = store.alts.find(a => a.id === id);
  return alt ? alt.session : null;
}
