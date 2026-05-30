const ENCRYPTION_KEY = 'JDCollect_v2_SecretKey_2024';

async function encrypt(text) {
  if (!text) return '';
  try {
    const encoded = new TextEncoder().encode(text);
    const keyData = new TextEncoder().encode(ENCRYPTION_KEY.slice(0, 32));
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, encoded
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

async function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    const combined = new Uint8Array(
      atob(encryptedText).split('').map(c => c.charCodeAt(0))
    );
    const keyData = new TextEncoder().encode(ENCRYPTION_KEY.slice(0, 32));
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']
    );
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, data
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
