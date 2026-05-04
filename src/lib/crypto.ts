import { set, get } from 'idb-keyval';


export async function generateRSAKeyPair() {
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function prepareRegistrationData(keyPair: CryptoKeyPair, password: string) {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    const wrappingKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["wrapKey", "unwrapKey"]
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const wrappedPK = await window.crypto.subtle.wrapKey(
        "pkcs8",
        keyPair.privateKey,
        wrappingKey,
        { name: "AES-GCM", iv }
    );

    const pubRaw = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);

    const combined = new Uint8Array(iv.length + wrappedPK.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(wrappedPK), iv.length);

    return {
        publicKey: uint8ArrayToBase64(new Uint8Array(pubRaw)),
        wrappedPrivateKey: uint8ArrayToBase64(combined),
        salt: uint8ArrayToBase64(salt)
    };
}

/**
 * PHASE 3: Unwrap the Private Key
 */
export async function unwrapPrivateKey(wrappedBase64: string, password: string, saltBase64: string) {
    const encoder = new TextEncoder();
    const combined = base64ToUint8Array(wrappedBase64);
    const salt = base64ToUint8Array(saltBase64);

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    const wrappingKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["unwrapKey"]
    );

    return await window.crypto.subtle.unwrapKey(
        "pkcs8",
        ciphertext,
        wrappingKey,
        { name: "AES-GCM", iv },
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
    );
}

/**
 * PHASE 4: Encrypt a message (Hybrid Dual Encryption)
 * Encrypts the AES key for BOTH the recipient and the sender.
 */
export async function encryptMessage(
    message: string,
    recipientPublicKeyB64: string,
    senderPublicKeyB64: string
) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    // 1. Import Public Keys
    const importPub = (b64: string) => window.crypto.subtle.importKey(
        "spki", base64ToUint8Array(b64),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true, ["encrypt"]
    );

    const recipientPubKey = await importPub(recipientPublicKeyB64);
    const senderPubKey = await importPub(senderPublicKeyB64);

    // 2. Generate random AES-256 key and IV
    const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true, ["encrypt"]
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 3. Encrypt message with AES-GCM
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        data
    );

    // 4. Encrypt the AES key for both parties
    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

    const encryptedKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientPubKey, exportedAesKey);
    const encryptedKeyForSelf = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, senderPubKey, exportedAesKey);

    return {
        ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
        iv: uint8ArrayToBase64(iv),
        encryptedKey: uint8ArrayToBase64(new Uint8Array(encryptedKey)),
        encryptedKeyForSelf: uint8ArrayToBase64(new Uint8Array(encryptedKeyForSelf))
    };
}

/**
 * PHASE 4: Decrypt a message
 */
export async function decryptMessage(
    payload: { ciphertext: string, iv: string, encryptedKey: string },
    privateKey: CryptoKey
) {
    const decoder = new TextDecoder();

    // 1. Decrypt the AES key using our RSA private key
    const aesKeyBuffer = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        base64ToUint8Array(payload.encryptedKey)
    );

    // 2. Import the AES key
    const aesKey = await window.crypto.subtle.importKey(
        "raw", aesKeyBuffer, "AES-GCM", true, ["decrypt"]
    );

    // 3. Decrypt the ciphertext
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToUint8Array(payload.iv) },
        aesKey,
        base64ToUint8Array(payload.ciphertext)
    );

    return decoder.decode(decryptedBuffer);
}

/**
 * BASE64 HELPERS
 */
export function base64ToUint8Array(base64: string) {
    // 1. Clean the string: remove PEM headers/footers and all whitespace/newlines
    const cleaned = base64
        .replace(/-----BEGIN [^-----]+-----/g, '')
        .replace(/-----END [^-----]+-----/g, '')
        .replace(/[\s\r\n]/g, '');

    try {
        const binary = window.atob(cleaned);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        console.error("Base64 Decoding Failed for string:", cleaned.substring(0, 50) + "...");
        throw e;
    }
}

export function uint8ArrayToBase64(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export async function storePrivateKey(key: CryptoKey) {
    await set('whisper_private_key', key);
}

export async function getStoredPrivateKey() {
    return await get<CryptoKey>('whisper_private_key');
}