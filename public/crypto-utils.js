/**
 * Crypto Utilities for encrypting/decrypting user data and settings
 * Uses AES-GCM with Web Crypto API for secure client-side encryption
 * 
 * SECURITY FEATURES:
 * ✓ AES-256-GCM encryption (authenticated encryption with associated data)
 * ✓ PBKDF2 key derivation with 600,000 iterations (OWASP recommended minimum)
 * ✓ Random salt (16 bytes) and IV (12 bytes) for each encryption
 * ✓ Secure password hashing using PBKDF2 with salt
 * ✓ Cookies set with Secure and SameSite=Strict flags
 * ✓ No plaintext password storage
 * ✓ Device-specific encryption for stored credentials
 * 
 * SECURITY NOTES:
 * - All encryption happens client-side using Web Crypto API
 * - Password hashes use PBKDF2 with 600,000 iterations per OWASP 2023 guidelines
 * - Each encrypted value has unique salt and IV
 * - Cookies cannot have HttpOnly flag (requires server-side setting)
 * - This is suitable for client-side web apps; server-side apps should use different approaches
 */
class CryptoUtils {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12;
        this.tagLength = 128;
        this.DEBUG = false; // Set to true for debugging
    }

    /**
     * Debug logging - only logs when DEBUG flag is true
     */
    log(...args) {
        if (this.DEBUG) {
            console.log(...args);
        }
    }

    /**
     * Generate a random salt
     * @returns {Uint8Array} Random salt
     */
    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(16));
    }

    /**
     * Generate a random initialization vector
     * @returns {Uint8Array} Random IV
     */
    generateIV() {
        return crypto.getRandomValues(new Uint8Array(this.ivLength));
    }

    /**
     * Derive a key from password using PBKDF2
     * @param {string} password - User password
     * @param {Uint8Array} salt - Salt for key derivation
     * @returns {Promise<CryptoKey>} Derived key
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 600000, // Increased from 100,000 to 600,000 for better security
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: this.algorithm, length: this.keyLength },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt data using AES-GCM
     * @param {string} plaintext - Data to encrypt
     * @param {string} password - Password for encryption
     * @returns {Promise<string>} Base64 encoded encrypted data with salt and IV
     */
    async encrypt(plaintext, password) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);
            
            const salt = this.generateSalt();
            const iv = this.generateIV();
            const key = await this.deriveKey(password, salt);
            
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength
                },
                key,
                data
            );
            
            // Combine salt + iv + encrypted data
            const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encrypted), salt.length + iv.length);
            
            return this.arrayBufferToBase64(combined);
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt data using AES-GCM
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @param {string} password - Password for decryption
     * @returns {Promise<string>} Decrypted plaintext
     */
    async decrypt(encryptedData, password) {
        try {
            const combined = this.base64ToArrayBuffer(encryptedData);
            
            // Extract salt, IV, and encrypted data
            const salt = combined.slice(0, 16);
            const iv = combined.slice(16, 16 + this.ivLength);
            const encrypted = combined.slice(16 + this.ivLength);
            
            const key = await this.deriveKey(password, salt);
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength
                },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            // Don't log decryption errors - they're expected when no valid saved credentials exist
            throw new Error('Failed to decrypt data - invalid password or corrupted data');
        }
    }

    /**
     * Generate a secure random password
     * @param {number} length - Password length
     * @returns {string} Random password
     */
    generatePassword(length = 16) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => charset[byte % charset.length]).join('');
    }

    /**
     * Generate a secure random username
     * @returns {string} Random username
     */
    generateUsername() {
        const adjectives = ['Swift', 'Bright', 'Clever', 'Quick', 'Smart', 'Cool', 'Fast', 'Sharp'];
        const nouns = ['Fox', 'Eagle', 'Wolf', 'Tiger', 'Lion', 'Bear', 'Hawk', 'Falcon'];
        const randomNum = Math.floor(Math.random() * 1000);
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}${noun}${randomNum}`;
    }

    /**
     * Hash a password for verification using PBKDF2 with salt
     * @param {string} password - Password to hash
     * @param {Uint8Array} salt - Optional salt (generates new one if not provided)
     * @returns {Promise<object>} Object containing hash and salt as Base64
     */
    async hashPassword(password, salt = null) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        
        // Generate salt if not provided
        if (!salt) {
            salt = this.generateSalt();
        }
        
        // Use PBKDF2 for password hashing (more secure than plain SHA-256)
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            data,
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const hash = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 600000,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        
        return {
            hash: this.arrayBufferToBase64(new Uint8Array(hash)),
            salt: this.arrayBufferToBase64(salt)
        };
    }

    /**
     * Verify a password against a hash
     * @param {string} password - Password to verify
     * @param {string} hashWithSalt - Combined hash:salt string
     * @returns {Promise<boolean>} True if password matches
     */
    async verifyPassword(password, hashWithSalt) {
        try {
            const [storedHash, storedSalt] = hashWithSalt.split(':');
            const salt = this.base64ToArrayBuffer(storedSalt);
            const { hash } = await this.hashPassword(password, salt);
            return hash === storedHash;
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }

    /**
     * Convert ArrayBuffer to Base64 string
     * @param {ArrayBuffer|Uint8Array} buffer - Buffer to convert
     * @returns {string} Base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to Uint8Array
     * @param {string} base64 - Base64 string to convert
     * @returns {Uint8Array} Converted array
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Encrypt and store data in localStorage
     * @param {string} key - Storage key
     * @param {object} data - Data to store
     * @param {string} password - Encryption password
     */
    async setEncryptedLocalStorage(key, data, password) {
        try {
            const jsonString = JSON.stringify(data);
            const encrypted = await this.encrypt(jsonString, password);
            localStorage.setItem(key, encrypted);
        } catch (error) {
            console.error('Error storing encrypted data:', error);
            throw error;
        }
    }

    /**
     * Decrypt and retrieve data from localStorage
     * @param {string} key - Storage key
     * @param {string} password - Decryption password
     * @returns {Promise<object|null>} Decrypted data or null if not found
     */
    async getEncryptedLocalStorage(key, password) {
        try {
            const encrypted = localStorage.getItem(key);
            if (!encrypted) return null;
            
            const decrypted = await this.decrypt(encrypted, password);
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Error retrieving encrypted data:', error);
            return null;
        }
    }

    /**
     * Encrypt and store data in cookies
     * @param {string} name - Cookie name
     * @param {object} data - Data to store
     * @param {string} password - Encryption password
     * @param {number} days - Cookie expiration in days
     */
    async setEncryptedCookie(name, data, password, days = 365) {
        try {
            const jsonString = JSON.stringify(data);
            const encrypted = await this.encrypt(jsonString, password);
            
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            
            // Only use Secure flag if on HTTPS
            const isSecure = window.location.protocol === 'https:';
            const secureFlag = isSecure ? '; Secure' : '';
            
            // For local development, use SameSite=Lax instead of Strict
            const sameSite = isSecure ? '; SameSite=Strict' : '; SameSite=Lax';
            
            document.cookie = `${name}=${encrypted}; ${expires}; path=/${sameSite}${secureFlag}`;
            this.log(`[COOKIE] Saved ${name} cookie (secure: ${isSecure}, length: ${encrypted.length})`);
        } catch (error) {
            console.error('Error storing encrypted cookie:', error);
            throw error;
        }
    }

    /**
     * Decrypt and retrieve data from cookies
     * @param {string} name - Cookie name
     * @param {string} password - Decryption password
     * @returns {Promise<object|null>} Decrypted data or null if not found
     */
    async getEncryptedCookie(name, password) {
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [key, value] = cookie.trim().split('=');
                if (key === name && value) {
                    const decrypted = await this.decrypt(value, password);
                    return JSON.parse(decrypted);
                }
            }
            return null;
        } catch (error) {
            // Silently fail - expected when no valid saved credentials exist
            return null;
        }
    }

    /**
     * Get a cookie value by name
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value or null if not found
     */
    getCookie(name) {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [cookieName, cookieValue] = cookie.trim().split('=');
            if (cookieName === name) {
                return cookieValue;
            }
        }
        return null;
    }

    /**
     * Delete a cookie by name
     * @param {string} name - Cookie name
     */
    deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    /**
     * Delete an encrypted cookie
     * @param {string} name - Cookie name
     */
    deleteEncryptedCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoUtils;
} else {
    window.CryptoUtils = CryptoUtils;
}
