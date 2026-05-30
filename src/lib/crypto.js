const SALT = new TextEncoder().encode('JDCollect_v2_salt_2024');
const ITERATIONS = 100000;

async function deriveKey(material) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(material),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(text, passphrase) {
  if (!text) return '';
  try {
    const key = await deriveKey(passphrase || 'JDCollect_default');
    const encoded = new TextEncoder().encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error('加密失败:', e);
    return btoa(unescape(encodeURIComponent(text)));
  }
}

async function decrypt(encryptedText, passphrase) {
  if (!encryptedText) return '';
  try {
    const key = await deriveKey(passphrase || 'JDCollect_default');
    const combined = new Uint8Array(
      atob(encryptedText).split('').map(c => c.charCodeAt(0))
    );
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('解密失败:', e);
    try {
      return decodeURIComponent(escape(atob(encryptedText)));
    } catch {
      return encryptedText;
    }
  }
}

export { encrypt, decrypt };
