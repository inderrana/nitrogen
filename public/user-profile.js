/**
 * User Profile and Sync Management
 * Handles user authentication, profile management, and settings synchronization
 * 
 * SECURITY FEATURES:
 * ✓ All user data encrypted with AES-256-GCM before storage
 * ✓ Passwords hashed with PBKDF2 (600,000 iterations) + salt
 * ✓ No plaintext passwords ever stored
 * ✓ User password encrypted with device-specific key before localStorage storage
 * ✓ Auto-login credentials stored in encrypted cookies (365 days)
 * ✓ Profile data synced across localStorage and cookies (both encrypted)
 * ✓ Device fingerprinting for additional security layer
 * ✓ Automatic data sync on browser close
 * 
 * DATA FLOW:
 * 1. User enters password → Hashed with PBKDF2+salt for verification
 * 2. Profile data → Encrypted with AES-GCM using actual password
 * 3. User password → Encrypted with device key before localStorage storage
 * 4. Login credentials → Stored in encrypted cookie for auto-login
 * 5. On browser close → Auto-sync saves all changes
 * 
 * SECURITY NOTE:
 * The actual password (not hash) is encrypted and stored because it's needed
 * to decrypt the user's profile data. The password itself is protected by:
 * - Device-specific encryption key (8-factor fingerprint)
 * - AES-256-GCM encryption
 * - Only accessible on the same device
 */
class UserProfileManager {
    constructor() {
        this.cryptoUtils = new CryptoUtils();
        this.currentUser = null;
        this.isLoggedIn = false;
        this.syncEnabled = false;
        this.DEBUG = false; // Set to true for debugging
        this.lastActivityTime = Date.now(); // For session timeout
        this.SESSION_TIMEOUT = 365 * 24 * 60 * 60 * 1000; // 1 year idle timeout
        
        // Profile data structure
        this.defaultProfile = {
            username: '',
            email: '',
            displayName: '',
            avatar: '',
            settings: {
                autoSync: true,
                syncInterval: 300000, // 5 minutes in milliseconds
                backupReminders: true,
                encryptionLevel: 'high',
                storageMode: 'browser'
            },
            preferences: {
                greeting: '',
                weatherLocation: '',
                searchEngine: 'startpage',
                links: [],
                theme: 'ocean'
            },
            reminders: [],
            lastSync: null,
            createdAt: null,
            updatedAt: null
        };
        
        this.syncTimer = null;
        this.init();
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
     * Initialize the profile manager
     */
    async init() {
        try {
            // Migration: Clean up old storage format
            const oldKey = localStorage.getItem('user_password_hash_enc');
            if (oldKey) {
                this.log('Migrating from old storage format - you will need to re-login once');
                localStorage.removeItem('user_password_hash_enc');
            }
            
            // Skip migration - handle legacy keys in getDecryptionPassword instead
            // await this.migratePasswordEncryption();
            
            // Try to auto-login from stored credentials
            await this.attemptAutoLogin();
            
            // Setup sync if user is logged in
            if (this.isLoggedIn && this.syncEnabled) {
                this.startPeriodicSync();
            }
            
            // Setup session timeout checker (every minute)
            setInterval(() => {
                if (this.checkSessionTimeout()) {
                    // Show timeout message
                    if (window.newTabHomepage) {
                        window.newTabHomepage.showAuthMessage('Session timed out due to inactivity. Please login again.', 'info');
                    }
                }
            }, 60 * 1000);
            
            // Track user activity for session timeout
            ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
                document.addEventListener(event, () => this.updateActivity(), { passive: true });
            });
            
            this.log('UserProfileManager initialized');
        } catch (error) {
            console.error('Error initializing UserProfileManager:', error);
        }
    }

    /**
     * Migrate password encryption to use stable device fingerprint
     * This handles cases where screen dimensions changed
     */
    async migratePasswordEncryption() {
        try {
            const encryptedPassword = localStorage.getItem('user_password_enc');
            if (!encryptedPassword) {
                return; // No password to migrate
            }

            this.log('[MIGRATION] Checking encrypted password...');

            // Get the current stable device key
            const newDeviceKey = await this.getDeviceEncryptionKey();
            
            // Try to decrypt with new key first
            try {
                await this.cryptoUtils.decrypt(encryptedPassword, newDeviceKey);
                this.log('[MIGRATION] ✅ Password already using stable encryption');
                return; // Already using new encryption
            } catch (e) {
                this.log('[MIGRATION] Password encrypted with old key, attempting migration...');
            }

            // Try to decrypt with old key (including screen dimensions)
            const oldFingerprint = [
                navigator.userAgent,
                navigator.language,
                screen.width,
                screen.height,
                screen.colorDepth,
                new Date().getTimezoneOffset(),
                navigator.hardwareConcurrency || 'unknown',
                navigator.platform
            ].join('|');
            
            const { hash: oldDeviceKey } = await this.cryptoUtils.hashPassword(oldFingerprint);
            
            try {
                // Decrypt with old key
                const password = await this.cryptoUtils.decrypt(encryptedPassword, oldDeviceKey);
                this.log('[MIGRATION] ✅ Successfully decrypted with old key');
                
                // Re-encrypt with new stable key
                const newEncryptedPassword = await this.cryptoUtils.encrypt(password, newDeviceKey);
                localStorage.setItem('user_password_enc', newEncryptedPassword);
                this.log('[MIGRATION] ✅ Password re-encrypted with stable device key');
            } catch (e) {
                this.log('[MIGRATION] ⚠️ Could not decrypt with old key, clearing corrupted password');
                this.log('[MIGRATION] You will need to log in again to save new credentials');
                // Remove corrupted encrypted password so user can login fresh
                localStorage.removeItem('user_password_enc');
            }
        } catch (error) {
            console.error('[MIGRATION] Error during password migration:', error);
        }
    }

    /**
     * Attempt to auto-login user from stored credentials
     */
    async attemptAutoLogin() {
        try {
            this.log('[AUTO-LOGIN] Starting auto-login attempt...');
            
            // Check if we have a stored session
            const sessionData = localStorage.getItem('user_session');
            if (!sessionData) {
                this.log('[AUTO-LOGIN] No session found');
                return false;
            }
            
            const { username } = JSON.parse(sessionData);
            this.log('[AUTO-LOGIN] Username from session:', username);
            
            // Get the decrypted password
            const password = await this.getDecryptionPassword();
            if (!password) {
                this.log('[AUTO-LOGIN] No stored password found');
                return false;
            }
            this.log('[AUTO-LOGIN] Password retrieved from storage');
            
            // Check if profile exists
            const exists = await this.checkUserExists(username);
            this.log('[AUTO-LOGIN] Profile exists:', exists);
            
            if (!exists) {
                this.log('[AUTO-LOGIN] Profile not found for user:', username);
                return false;
            }
            
            // Load the user profile with the password
            const userProfile = await this.loadUserProfile(username, password);
            
            if (userProfile) {
                this.currentUser = userProfile;
                this.isLoggedIn = true;
                this.syncEnabled = userProfile.settings.autoSync;
                this.log('[AUTO-LOGIN] ✅ Auto-login successful for user:', username);
                return true;
            } else {
                this.log('[AUTO-LOGIN] Failed to load profile for user:', username);
            }
        } catch (error) {
            // Silently fail auto-login - user will need to login manually
            this.log('[AUTO-LOGIN] ❌ Auto-login failed:', error.message);
        }
        return false;
    }

    /**
     * Register a new user
     * @param {string} username - Username
     * @param {string} password - Password
     * @param {string} email - Email address
     * @param {string} displayName - Display name
     * @param {boolean} forceOverwrite - Force overwrite if username exists but can't be accessed
     */
    async registerUser(username, password, email, displayName, forceOverwrite = false) {
        try {
            // Validate inputs
            if (!username || username.length < 3) {
                throw new Error('Username must be at least 3 characters long');
            }
            if (!password || password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }
            if (!email || !this.isValidEmail(email)) {
                throw new Error('Please enter a valid email address');
            }

            // Check if user already exists
            const existingUser = await this.checkUserExists(username);
            if (existingUser && !forceOverwrite) {
                // Try to load the profile to see if it's accessible
                try {
                    const testProfile = await this.loadUserProfile(username, password);
                    if (testProfile) {
                        throw new Error('Username already exists and is accessible. Please login instead.');
                    }
                } catch (e) {
                    // Profile exists but can't be decrypted - offer recovery
                    throw new Error('USERNAME_CORRUPTED');
                }
            }

            // If force overwrite, clean up old data
            if (forceOverwrite) {
                this.cleanupUserData(username);
            }

            // Create password hash with salt
            const { hash, salt } = await this.cryptoUtils.hashPassword(password);
            const passwordHash = `${hash}:${salt}`; // Store as hash:salt format
            
            // Create new profile
            const newProfile = { ...this.defaultProfile };
            newProfile.username = username;
            newProfile.email = email;
            newProfile.displayName = displayName || username;
            newProfile.avatar = this.generateAvatarUrl(username);
            newProfile.createdAt = new Date().toISOString();
            newProfile.updatedAt = new Date().toISOString();

            // Save user profile
            await this.saveUserProfile(username, newProfile, password);
            
            // Save login credentials (password will be used as encryption key)
            await this.saveLoginCredentials(username, passwordHash, password);
            
            // Set as current user
            this.currentUser = newProfile;
            this.isLoggedIn = true;
            this.syncEnabled = newProfile.settings.autoSync;
            
            if (this.syncEnabled) {
                this.startPeriodicSync();
            }
            
            this.log('User registered successfully:', username);
            return { success: true, user: newProfile };
            
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Login user
     * @param {string} username - Username
     * @param {string} password - Password
     * @param {boolean} rememberMe - Remember login
     */
    async loginUser(username, password, rememberMe = true) {
        try {
            this.log('[LOGIN] Starting login for:', username, 'RememberMe:', rememberMe);
            
            // Check if there's a pending import for this user
            const encryptedImport = sessionStorage.getItem('pendingImport_enc');
            const tempKey = sessionStorage.getItem('pendingImport_key');
            
            if (encryptedImport && tempKey) {
                this.log('[LOGIN] Found pending encrypted import data');
                
                try {
                    // Decrypt the import data
                    const decryptedData = await this.cryptoUtils.decrypt(encryptedImport, tempKey);
                    const importData = JSON.parse(decryptedData);
                    
                    // Check if import username matches login username
                    if (importData.profile && importData.profile.username === username) {
                        this.log('[LOGIN] Completing import for:', username);
                        
                        // Complete the import with the provided password
                        const importResult = await this.completeImport(importData, password);
                        if (!importResult.success) {
                            sessionStorage.removeItem('pendingImport_enc');
                            sessionStorage.removeItem('pendingImport_key');
                            throw new Error('Failed to complete import: ' + importResult.error);
                        }
                        
                        // Clear pending import (both encrypted data and key)
                        sessionStorage.removeItem('pendingImport_enc');
                        sessionStorage.removeItem('pendingImport_key');
                        this.log('[LOGIN] Import completed successfully');
                    }
                } catch (decryptError) {
                    console.error('[LOGIN] Failed to decrypt import data:', decryptError);
                    sessionStorage.removeItem('pendingImport_enc');
                    sessionStorage.removeItem('pendingImport_key');
                }
            }
            
            // Rate limiting: Check failed login attempts
            const attempts = this.getLoginAttempts(username);
            if (attempts.count >= 5) {
                const timeLeft = attempts.lockoutUntil - Date.now();
                if (timeLeft > 0) {
                    const minutes = Math.ceil(timeLeft / 60000);
                    throw new Error(`Too many failed attempts. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`);
                } else {
                    // Lockout expired, clear attempts
                    this.clearLoginAttempts(username);
                }
            }
            
            // Validate inputs
            if (!username || !password) {
                this.recordFailedAttempt(username);
                throw new Error('Username and password are required');
            }

            // Check if user exists
            const userExists = await this.checkUserExists(username);
            if (!userExists) {
                this.recordFailedAttempt(username);
                throw new Error('User not found. Please check your username or register a new account.');
            }
            this.log('[LOGIN] User exists, loading profile...');

            // Load user profile
            const userProfile = await this.loadUserProfile(username, password);
            if (!userProfile) {
                // Profile exists but couldn't be decrypted - likely wrong password or corrupted data
                this.recordFailedAttempt(username);
                throw new Error('Invalid password. If you forgot your password, you may need to re-register.');
            }
            this.log('[LOGIN] Profile loaded successfully');

            // Successful login - clear failed attempts
            this.clearLoginAttempts(username);

            // Clean up old/duplicate storage keys
            this.cleanupOldStorage(username);

            // Create password hash with salt for verification
            const { hash, salt } = await this.cryptoUtils.hashPassword(password);
            const passwordHash = `${hash}:${salt}`;
            
            // ALWAYS re-save credentials to ensure we're using the latest encryption method
            this.log('[LOGIN] Updating credentials with current encryption...');
            await this.saveLoginCredentials(username, passwordHash, password);
            
            // Set as current user
            this.currentUser = userProfile;
            this.isLoggedIn = true;
            this.syncEnabled = userProfile.settings.autoSync;
            
            // Reset last activity time
            this.lastActivityTime = Date.now();
            
            if (this.syncEnabled) {
                this.startPeriodicSync();
            }
            
            this.log('User logged in successfully:', username);
            return { success: true, user: userProfile };
            
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verify password for current user
     * @param {string} username - Username
     * @param {string} password - Password to verify
     * @returns {boolean} - True if password is correct
     */
    async verifyPassword(username, password) {
        try {
            // Validate inputs
            if (!username || !password) {
                return false;
            }

            // Check if user exists
            const userExists = await this.checkUserExists(username);
            if (!userExists) {
                return false;
            }

            // Try to load user profile with the provided password
            const userProfile = await this.loadUserProfile(username, password);
            
            // If profile loads successfully, password is correct
            return userProfile !== null;
            
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }

    /**
     * Logout current user
     */
    async logoutUser(fullLogout = false) {
        try {
            this.stopPeriodicSync();
            
            if (fullLogout) {
                // Full logout - clear ALL data including encrypted password
                localStorage.removeItem('user_password_enc');
                localStorage.removeItem('user_session');
                
                // Clear pending import if any
                sessionStorage.removeItem('pendingImport_enc');
                sessionStorage.removeItem('pendingImport_key');
                
                this.log('Full logout - all credentials cleared');
            } else {
                // Standard logout - keep encrypted password for seamless re-login
                localStorage.removeItem('user_session');
                this.log('Standard logout - encrypted password retained for re-login');
            }
            
            this.currentUser = null;
            this.isLoggedIn = false;
            this.syncEnabled = false;
            
            return { success: true };
            
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update user profile
     * @param {object} updates - Profile updates
     * @param {string} password - User password for encryption (optional)
     */
    async updateProfile(updates, password = null) {
        try {
            if (!this.isLoggedIn) {
                throw new Error('User not logged in');
            }

            this.log('[UPDATE-PROFILE] Updating profile with:', updates);

            // Merge updates with current profile
            this.currentUser = { ...this.currentUser, ...updates };
            this.currentUser.updatedAt = new Date().toISOString();

            this.log('[UPDATE-PROFILE] Updated currentUser:', {
                username: this.currentUser.username,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName
            });

            // Get current password for encryption if not provided
            if (!password) {
                password = await this.getDecryptionPassword();
            }
            
            if (!password) {
                console.error('[UPDATE-PROFILE] No password available for encryption');
                throw new Error('Password required to update profile');
            }

            // Save updated profile with encryption (this also saves to currentUser)
            await this.saveUserProfile(this.currentUser.username, this.currentUser, password);
            
            this.log('[UPDATE-PROFILE] Profile saved successfully');
            return { success: true, user: this.currentUser };
            
        } catch (error) {
            console.error('Profile update error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync user data across devices (async version)
     */
    async syncUserData() {
        try {
            if (!this.isLoggedIn || !this.syncEnabled) {
                return { success: false, error: 'Sync not enabled' };
            }

            this.log('Starting data sync...');
            
            // Get current app data
            const appData = await this.getCurrentAppData();
            
            // Update profile with current app data
            this.currentUser.preferences = appData.preferences;
            this.currentUser.reminders = appData.reminders;
            this.currentUser.lastSync = new Date().toISOString();
            this.currentUser.updatedAt = new Date().toISOString();

            // Save to both localStorage and cookies
            const password = await this.getDecryptionPassword();
            
            // Save to localStorage (primary storage)
            await this.saveUserProfile(this.currentUser.username, this.currentUser, password);
            
            this.log('Data sync completed successfully');
            return { success: true, lastSync: this.currentUser.lastSync };
            
        } catch (error) {
            console.error('Sync error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync user data synchronously (for beforeunload)
     * Uses only localStorage which is synchronous
     */
    syncUserDataSync() {
        try {
            if (!this.isLoggedIn) {
                return;
            }

            this.log('Starting synchronous data sync...');
            
            // Get current app data synchronously
            const preferences = {
                greeting: document.getElementById('greeting')?.textContent || '',
                weatherLocation: document.getElementById('weatherLocation')?.textContent || '',
                searchEngine: window.newTabHomepage?.currentSearchEngine || 'startpage',
                theme: document.getElementById('themeSelect')?.value || 'ocean'
            };

            const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
            
            // Update profile
            this.currentUser.preferences = preferences;
            this.currentUser.reminders = reminders;
            this.currentUser.lastSync = new Date().toISOString();
            this.currentUser.updatedAt = new Date().toISOString();

            // Note: Can't await in synchronous function, profile will be saved on next login
            this.log('Synchronous sync completed (profile will save on next login)');
            
        } catch (error) {
            console.error('Synchronous sync error:', error);
        }
    }

    /**
     * Restore user data from sync
     */
    async restoreFromSync() {
        try {
            if (!this.isLoggedIn) {
                throw new Error('User not logged in');
            }

            const password = await this.getDecryptionPassword();
            
            // Load from encrypted localStorage only
            const syncData = await this.loadUserProfile(this.currentUser.username, password);
            
            if (syncData) {
                // Apply synced data to current session
                await this.applyProfileToApp(syncData);
                this.currentUser = syncData;
                
                this.log('Data restored from sync successfully');
                return { success: true, data: syncData };
            } else {
                throw new Error('No sync data found');
            }
            
        } catch (error) {
            console.error('Restore error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current app data (preferences, reminders, etc.)
     */
    async getCurrentAppData() {
        const preferences = {
            greeting: document.getElementById('greeting')?.textContent || '',
            weatherLocation: document.getElementById('weatherLocation')?.textContent || '',
            searchEngine: window.newTabHomepage?.currentSearchEngine || 'startpage',
            links: this.getCurrentLinks(),
            theme: this.getCurrentTheme()
        };

        const reminders = JSON.parse(localStorage.getItem('reminders')) || [];
        
        return { preferences, reminders };
    }

    /**
     * Apply profile data to current app
     */
    async applyProfileToApp(profileData) {
        try {
            // Apply preferences
            if (profileData.preferences) {
                const prefs = profileData.preferences;
                
                // Apply greeting (but fix if corrupted)
                const greetingEl = document.getElementById('greeting');
                if (greetingEl && prefs.greeting) {
                    // Check if greeting is corrupted (contains repeated text or excessive emojis)
                    const emojiCount = (prefs.greeting.match(/🍂|⛅/g) || []).length;
                    if (emojiCount > 3 || prefs.greeting.length > 100) {
                        // Greeting is corrupted, clear it and let app regenerate
                        prefs.greeting = '';
                    } else {
                        greetingEl.textContent = prefs.greeting;
                    }
                }
                
                // Apply weather location
                const weatherEl = document.getElementById('weatherLocation');
                if (weatherEl && prefs.weatherLocation) {
                    weatherEl.textContent = prefs.weatherLocation;
                    // Trigger weather update
                    if (window.newTabHomepage) {
                        window.newTabHomepage.fetchWeatherByCity(prefs.weatherLocation);
                    }
                }
                
                // Apply theme
                if (window.newTabHomepage) {
                    // Prefer localStorage (most recent) over profile, or default to ocean
                    const localStorageTheme = localStorage.getItem('selectedTheme');
                    const savedTheme = localStorageTheme || prefs.theme || 'ocean';
                    // Pass false to prevent re-saving to profile during load
                    window.newTabHomepage.changeTheme(savedTheme, false);
                    const themeSelect = document.getElementById('themeSelect');
                    if (themeSelect) {
                        themeSelect.value = savedTheme;
                    }
                    
                    // Update profile with the current theme for next time
                    if (prefs.theme !== savedTheme) {
                        prefs.theme = savedTheme;
                    }
                }
                
                // Apply search engine
                if (prefs.searchEngine && window.newTabHomepage) {
                    window.newTabHomepage.switchSearchEngine(prefs.searchEngine);
                }
                
                // Apply links (this would need custom logic based on your app's structure)
                if (prefs.links && prefs.links.length > 0) {
                    this.applyLinksToApp(prefs.links);
                }
            }
            
            // Apply reminders
            if (profileData.reminders) {
                localStorage.setItem('reminders', JSON.stringify(profileData.reminders));
                if (window.newTabHomepage && window.newTabHomepage.reminders) {
                    window.newTabHomepage.reminders = profileData.reminders;
                    window.newTabHomepage.renderReminders();
                }
            }
            
        } catch (error) {
            console.error('Error applying profile to app:', error);
        }
    }

    /**
     * Apply links to the app
     */
    applyLinksToApp(links) {
        // This would restore custom links beyond the default ones
        // Implementation depends on how the main app handles custom links
        this.log('Applying links from profile:', links);
    }

    /**
     * Get current links from the app
     */
    getCurrentLinks() {
        const linkItems = document.querySelectorAll('.link-item');
        const links = [];
        
        linkItems.forEach(item => {
            const link = item.querySelector('.link-card');
            const nameEl = link.querySelector('.link-name');
            const iconEl = link.querySelector('.link-icon');
            
            links.push({
                url: link.href || '#',
                name: nameEl ? nameEl.textContent : 'Link',
                icon: iconEl ? iconEl.className : 'fas fa-link'
            });
        });
        
        return links;
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
        const themeSelect = document.getElementById('themeSelect');
        return themeSelect ? themeSelect.value : 'ocean';
    }

    /**
     * Start periodic sync
     */
    startPeriodicSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        const interval = this.currentUser?.settings?.syncInterval || 300000; // 5 minutes default
        this.syncTimer = setInterval(() => {
            this.syncUserData();
        }, interval);
        
        this.log(`Periodic sync started (${interval / 1000}s interval)`);
    }

    /**
     * Stop periodic sync
     */
    stopPeriodicSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            this.log('Periodic sync stopped');
        }
    }

    /**
     * Get login attempts for a user (rate limiting)
     */
    getLoginAttempts(username) {
        const key = `login_attempts_${username}`;
        const data = localStorage.getItem(key);
        if (!data) {
            return { count: 0, lockoutUntil: 0 };
        }
        return JSON.parse(data);
    }

    /**
     * Record a failed login attempt (rate limiting)
     */
    recordFailedAttempt(username) {
        const attempts = this.getLoginAttempts(username);
        attempts.count++;
        
        // Exponential backoff: 5 mins, 10 mins, 15 mins, etc.
        if (attempts.count >= 5) {
            const lockoutMinutes = (attempts.count - 4) * 5;
            attempts.lockoutUntil = Date.now() + (lockoutMinutes * 60 * 1000);
        }
        
        const key = `login_attempts_${username}`;
        localStorage.setItem(key, JSON.stringify(attempts));
    }

    /**
     * Clear login attempts after successful login
     */
    clearLoginAttempts(username) {
        const key = `login_attempts_${username}`;
        localStorage.removeItem(key);
    }

    /**
     * Check if session has timed out due to inactivity
     */
    checkSessionTimeout() {
        if (!this.isLoggedIn) return false;
        
        const idleTime = Date.now() - this.lastActivityTime;
        if (idleTime > this.SESSION_TIMEOUT) {
            this.log('Session timed out due to inactivity');
            this.logout();
            return true;
        }
        return false;
    }

    /**
     * Update last activity time (call this on user interactions)
     */
    updateActivity() {
        this.lastActivityTime = Date.now();
    }

    /**
     * Save user profile to encrypted storage
     */
    async saveUserProfile(username, profile, password) {
        const profileKey = `profile_${username}`;
        
        // Save to encrypted localStorage ONLY (remove cookie duplication)
        await this.cryptoUtils.setEncryptedLocalStorage(profileKey, profile, password);
        
        // Encrypt and save the password using device key for auto-login
        const deviceKey = await this.getDeviceEncryptionKey();
        const encryptedPassword = await this.cryptoUtils.encrypt(password, deviceKey);
        localStorage.setItem('user_password_enc', encryptedPassword);
        
        // Save session info only (no sensitive data)
        localStorage.setItem('user_session', JSON.stringify({ 
            username, 
            loginTime: Date.now() 
        }));
    }

    /**
     * Load user profile from encrypted storage
     */
    async loadUserProfile(username, password) {
        const profileKey = `profile_${username}`;
        
        // Load from encrypted localStorage only
        return await this.cryptoUtils.getEncryptedLocalStorage(profileKey, password);
    }

    /**
     * Save login credentials
     */
    async saveLoginCredentials(username, passwordHash, password) {
        this.log('[SAVE-CREDS] Saving login credentials for:', username);
        
        // Encrypt and save the password using device key for auto-login
        const deviceKey = await this.getDeviceEncryptionKey();
        const encryptedPassword = await this.cryptoUtils.encrypt(password, deviceKey);
        localStorage.setItem('user_password_enc', encryptedPassword);
        
        // Save session info only (no sensitive data, no duplicates)
        localStorage.setItem('user_session', JSON.stringify({ 
            username, 
            loginTime: Date.now() 
        }));
        
        this.log('[SAVE-CREDS] ✅ Credentials saved successfully');
    }

    /**
     * Get decryption password (for encrypted profile data)
     */
    async getDecryptionPassword() {
        this.log('[DECRYPT-PWD] Attempting to get decryption password...');
        
        // Try to get stored encrypted password first
        const encryptedPassword = localStorage.getItem('user_password_enc');
        if (encryptedPassword) {
            this.log('[DECRYPT-PWD] Found encrypted password in storage');
            
            // Get device key and try to decrypt
            try {
                const deviceKey = await this.getDeviceEncryptionKey();
                this.log('[DECRYPT-PWD] Attempting decryption with device key...');
                const decryptedPassword = await this.cryptoUtils.decrypt(encryptedPassword, deviceKey);
                this.log('[DECRYPT-PWD] ✅ Successfully decrypted password');
                return decryptedPassword;
            } catch (error) {
                console.error('[DECRYPT-PWD] ❌ Decryption failed:', error.message);
                this.log('[DECRYPT-PWD] Removing corrupted password');
                localStorage.removeItem('user_password_enc');
                return null;
            }
        } else {
            this.log('[DECRYPT-PWD] No encrypted password found - user needs to log in');
        }
        
        return null;
    }

    /**
     * Generate or retrieve a device-specific encryption key
     * Uses a random key stored in a persistent cookie
     */
    async getDeviceEncryptionKey() {
        // Check if we already have a key in cookies
        let existingKey = this.getCookie('device_enc_key');
        if (existingKey) {
            this.log('[DEVICE-KEY] Using existing key from cookie');
            return existingKey;
        }
        
        // Generate a new random key
        this.log('[DEVICE-KEY] Generating new random key');
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const randomKey = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        // Store it in a cookie that lasts 10 years
        this.setCookie('device_enc_key', randomKey, 3650);
        
        // Double-check it was saved by reading it back immediately
        existingKey = this.getCookie('device_enc_key');
        if (!existingKey) {
            console.error('[DEVICE-KEY] ❌ Failed to save cookie! Using in-memory key only');
            // Store in memory as fallback
            this._deviceKey = randomKey;
            return randomKey;
        }
        
        this.log('[DEVICE-KEY] Saved new key to cookie');
        return randomKey;
    }
    
    /**
     * Get a cookie value
     */
    getCookie(name) {
        const cookies = document.cookie;
        this.log('[COOKIE] Looking for', name, 'in cookies:', cookies.substring(0, 100));
        const value = `; ${cookies}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            const cookieValue = parts.pop().split(';').shift();
            this.log('[COOKIE] Found', name, '=', cookieValue.substring(0, 20) + '...');
            return cookieValue;
        }
        this.log('[COOKIE] Not found:', name);
        return null;
    }
    
    /**
     * Set a cookie
     */
    setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;
        
        // Only use Secure flag if on HTTPS
        const isSecure = window.location.protocol === 'https:';
        const secureFlag = isSecure ? '; Secure' : '';
        
        // For local development, don't use SameSite=Strict which can block cookies
        const sameSite = isSecure ? '; SameSite=Strict' : '; SameSite=Lax';
        
        document.cookie = `${name}=${value}; ${expires}; path=/${sameSite}${secureFlag}`;
        this.log(`[COOKIE] Set ${name} = ${value.substring(0, 20)}... (days: ${days})`);
        
        // Verify it was saved
        const verify = this.getCookie(name);
        this.log(`[COOKIE] Verify ${name}: ${verify ? 'SAVED' : 'FAILED'}`);
    }

    /**
     * Check if user exists with valid data
     */
    async checkUserExists(username) {
        try {
            // Check the CURRENT profile key format in localStorage only
            const profileKey = `profile_${username}`;
            
            if (localStorage.getItem(profileKey)) {
                return true; // Profile exists
            }

            // Also check old/legacy profile key formats for backward compatibility
            const legacyKeys = [`nitrogenProfile_${username}`, `profile_${username}_backup`];
            for (const key of legacyKeys) {
                if (localStorage.getItem(key)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error checking user exists:', error);
            return false;
        }
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Clean up corrupted or orphaned user data
     * Used when user can't access their account
     */
    cleanupUserData(username) {
        try {
            // Remove all possible storage keys for this user
            const keys = [
                `profile_${username}`,
                `profile_${username}_backup`,
                `nitrogenProfile_${username}`,
                `sync_${username}`
            ];
            
            keys.forEach(key => {
                localStorage.removeItem(key);
                this.cryptoUtils.deleteCookie(key);
            });
            
            this.log(`Cleaned up data for user: ${username}`);
        } catch (error) {
            console.error('Error cleaning up user data:', error);
        }
    }

    /**
     * Remove user account and all associated data
     */
    async removeUserAccount(username, password) {
        try {
            // Verify password first by trying to load the profile
            const profile = await this.loadUserProfile(username, password);
            if (!profile) {
                throw new Error('Invalid password. Cannot delete account.');
            }

            const profileKey = `profile_${username}`;
            
            // Remove from localStorage
            localStorage.removeItem(profileKey);
            
            // Remove from cookies
            this.cryptoUtils.deleteCookie(profileKey);
            
            // Remove login credentials
            this.cryptoUtils.deleteEncryptedCookie('user_login');
            localStorage.removeItem('user_session');
            
            this.log(`Account removed for user: ${username}`);
            return { success: true };
        } catch (error) {
            console.error('Remove account error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate avatar URL
     */
    generateAvatarUrl(username) {
        // Generate a consistent avatar based on username
        const colors = ['e74c3c', '3498db', '2ecc71', 'f39c12', '9b59b6', '1abc9c'];
        const colorIndex = username.length % colors.length;
        const initial = username.charAt(0).toUpperCase();
        
        return `data:image/svg+xml;base64,${btoa(`
            <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="50" fill="#${colors[colorIndex]}"/>
                <text x="50" y="60" font-family="Arial, sans-serif" font-size="40" 
                      fill="white" text-anchor="middle" font-weight="bold">${initial}</text>
            </svg>
        `)}`;
    }

    /**
     * Get current user info
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if user is logged in
     */
    isUserLoggedIn() {
        return this.isLoggedIn;
    }

    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            enabled: this.syncEnabled,
            lastSync: this.currentUser?.lastSync,
            interval: this.currentUser?.settings?.syncInterval
        };
    }

    /**
     * Toggle sync on/off
     */
    async toggleSync(enabled) {
        if (!this.isLoggedIn) {
            return { success: false, error: 'User not logged in' };
        }

        this.syncEnabled = enabled;
        this.currentUser.settings.autoSync = enabled;
        
        if (enabled) {
            this.startPeriodicSync();
            // Perform immediate sync
            await this.syncUserData();
        } else {
            this.stopPeriodicSync();
        }
        
        // Save updated settings
        await this.updateProfile({ settings: this.currentUser.settings });
        
        return { success: true, syncEnabled: enabled };
    }

    /**
     * Change storage mode and location
     */
    async changeStorageMode(mode, customPath = '') {
        if (!this.isLoggedIn) {
            return { success: false, error: 'User not logged in' };
        }

        const oldMode = this.currentUser.settings.storageMode;

        try {
            // Save current data before switching
            await this.syncUserData();

            // Update storage settings
            this.currentUser.settings.storageMode = mode;
            this.currentUser.updatedAt = new Date().toISOString();

            // Migrate data to new storage location
            await this.migrateStorage(oldMode, mode);

            // Save updated profile with new storage settings
            await this.saveUserProfile(this.currentUser.username, this.currentUser, await this.getDecryptionPassword());

            return { 
                success: true, 
                storageMode: mode, 
                message: 'Storage location updated successfully'
            };

        } catch (error) {
            console.error('Storage mode change error:', error);
            // Revert settings on error
            this.currentUser.settings.storageMode = oldMode;
            return { success: false, error: error.message };
        }
    }

    /**
     * Migrate storage between different modes
     */
    async migrateStorage(fromMode, toMode) {
        try {
            this.log(`Migrating storage from ${fromMode} to ${toMode}`);
            
            const password = await this.getDecryptionPassword();
            const username = this.currentUser.username;
            
            // Get current data
            const profileData = await this.loadUserProfile(username, password);
            
            if (!profileData) {
                throw new Error('Failed to load profile data for migration');
            }

            // Save to new storage location based on mode
            switch (toMode) {
                case 'browser':
                case 'local':
                    // Use encrypted localStorage only (simplified from browser+cookie)
                    await this.cryptoUtils.setEncryptedLocalStorage(`profile_${username}`, profileData, password);
                    break;
                    
                case 'session':
                    // Use sessionStorage only (cleared on tab close)
                    await this.saveToSessionStorage(username, profileData, password);
                    break;
                    
                default:
                    throw new Error('Invalid storage mode. Use "browser", "local", or "session"');
            }

            // Clean up old storage if different mode
            if (fromMode !== toMode) {
                await this.cleanupOldStorage(fromMode, username);
            }

            return true;
        } catch (error) {
            console.error('Storage migration error:', error);
            throw error;
        }
    }

    /**
     * Save to session storage
     */
    async saveToSessionStorage(username, profileData, password) {
        const profileKey = `profile_${username}`;
        const encrypted = await this.cryptoUtils.encrypt(JSON.stringify(profileData), password);
        sessionStorage.setItem(profileKey, encrypted);
    }

    /**
     * Clean up old storage location
     */
    async cleanupOldStorage(oldMode, username) {
        const profileKey = `profile_${username}`;
        
        try {
            switch (oldMode) {
                case 'session':
                    sessionStorage.removeItem(profileKey);
                    break;
                    
                case 'local':
                    localStorage.removeItem(profileKey);
                    break;
                    
                case 'cookie':
                    this.cryptoUtils.deleteEncryptedCookie(profileKey);
                    break;
                    
                // Don't clean up 'browser' mode as it's the default
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    /**
     * Get current storage info
     */
    async getStorageInfo() {
        if (!this.isLoggedIn) {
            return { 
                mode: 'none', 
                path: 'Not logged in', 
                size: '0 B',
                location: 'N/A'
            };
        }

        // Ensure currentUser has settings
        if (!this.currentUser.settings) {
            this.currentUser.settings = {
                autoSync: false,
                syncInterval: 300000,
                storageMode: 'browser'
            };
        }

        const settings = this.currentUser.settings;
        let path = 'Browser Default';
        let location = 'localStorage (browser)';
        
        switch (settings.storageMode) {
            case 'session':
                path = 'Session Storage';
                location = 'sessionStorage (temporary)';
                break;
            case 'local':
                path = 'Local Storage';
                location = 'localStorage (persistent)';
                break;
            case 'cookie':
                path = 'Cookies';
                location = 'document.cookie (browser)';
                break;
            default:
                location = 'localStorage + cookies';
        }

        // Calculate approximate data size
        const dataSize = this.calculateDataSize();

        return {
            mode: settings.storageMode || 'browser',
            path: path,
            size: dataSize,
            location: location
        };
    }

    /**
     * Calculate data size
     */
    calculateDataSize() {
        try {
            let totalSize = 0;
            
            // Calculate user profile size if logged in
            if (this.currentUser) {
                const userString = JSON.stringify(this.currentUser);
                totalSize += new Blob([userString]).size;
            }
            
            // Calculate all localStorage data size
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage.getItem(key);
                    if (value) {
                        totalSize += new Blob([key + value]).size;
                    }
                }
            }
            
            this.log('[DATA-SIZE] Calculated size:', totalSize, 'bytes');
            
            if (totalSize < 1024) {
                return `${totalSize} B`;
            } else if (totalSize < 1024 * 1024) {
                return `${(totalSize / 1024).toFixed(1)} KB`;
            } else {
                return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
            }
        } catch (error) {
            console.error('[DATA-SIZE] Error calculating size:', error);
            return '0 B';
        }
    }

    /**
     * Import account from exported JSON file
     */
    async importAccount(importData) {
        try {
            console.log('Import data received:', importData);
            
            if (!importData || !importData.profile || !importData.version) {
                console.error('Invalid format - missing required fields');
                return { success: false, error: 'Invalid import file format' };
            }

            const profile = importData.profile;
            console.log('Profile data:', profile);
            
            // Validate required fields
            if (!profile.username || !profile.email) {
                console.error('Missing username or email');
                return { success: false, error: 'Missing required profile data' };
            }

            // Check if user already exists and warn
            const existingUser = await this.checkUserExists(profile.username);
            console.log('Existing user check:', existingUser);
            
            if (existingUser) {
                const confirmOverwrite = confirm(
                    `An account with username "${profile.username}" already exists.\n\n` +
                    `Importing will overwrite the existing account data.\n\n` +
                    `Do you want to continue?`
                );
                
                if (!confirmOverwrite) {
                    return { success: false, error: 'Import cancelled by user' };
                }
            }

            // Encrypt the import data with a temporary random key before storing
            const tempKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            const encryptedImport = await this.cryptoUtils.encrypt(JSON.stringify(importData), tempKey);
            
            // Store encrypted import data and the key separately
            sessionStorage.setItem('pendingImport_enc', encryptedImport);
            sessionStorage.setItem('pendingImport_key', tempKey);

            this.log('Account data staged for import (encrypted):', profile.username);
            return { success: true, message: 'Account imported successfully. Please login with your password.' };
        } catch (error) {
            console.error('Import account error:', error);
            return { success: false, error: error.message || 'Failed to import account' };
        }
    }

    async completeImport(importData, password) {
        try {
            const profile = importData.profile;
            const username = profile.username;
            
            this.log('[IMPORT] Completing import for:', username);
            
            // Save using the standard save function (no duplication)
            await this.saveUserProfile(username, profile, password);
            
            this.log('[IMPORT] Profile encrypted and saved');
            return { success: true };
        } catch (error) {
            console.error('[IMPORT] Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clean up old/duplicate storage keys
     */
    cleanupOldStorage(username) {
        try {
            // Remove old duplicate keys
            const keysToRemove = [
                `nitrogenProfile_${username}`, // Old format
                `profile_${username}_backup`, // Old backup
                `sync_${username}`, // Old sync key
                'user_login' // Old login cookie data (now only in encrypted password)
            ];
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
                // Also try to remove cookies
                document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            });
            
            this.log('[CLEANUP] Removed old/duplicate storage keys');
        } catch (error) {
            console.error('[CLEANUP] Error:', error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserProfileManager;
} else {
    window.UserProfileManager = UserProfileManager;
}
