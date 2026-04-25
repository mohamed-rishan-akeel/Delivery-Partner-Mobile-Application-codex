import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Platform-specific storage
// Use SecureStore on mobile, localStorage on web
const isWeb = Platform.OS === 'web';

const storage = {
    async setItem(key, value) {
        if (isWeb) {
            try {
                localStorage.setItem(key, value);
            } catch (error) {
                console.error('localStorage setItem error:', error);
            }
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    },

    async getItem(key) {
        if (isWeb) {
            try {
                return localStorage.getItem(key);
            } catch (error) {
                console.error('localStorage getItem error:', error);
                return null;
            }
        } else {
            return await SecureStore.getItemAsync(key);
        }
    },

    async removeItem(key) {
        if (isWeb) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error('localStorage removeItem error:', error);
            }
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    }
};

const KEYS = {
    AUTH_TOKEN: 'digifix_auth_token',
    USER_DATA: 'digifix_user_data',

};

/**
 * Save authentication token securely
 */
export const saveToken = async (token) => {
    try {
        await storage.setItem(KEYS.AUTH_TOKEN, token);
    } catch (error) {
        console.error('Error saving token:', error);
        throw error;
    }
};

/**
 * Get authentication token
 */
export const getAccessToken = async () => {
    try {
        const token = await storage.getItem(KEYS.AUTH_TOKEN);
        return token;
    } catch (error) {
        console.error('Error getting access token:', error);
        return null;
    }
};

/**
 * Whether the app is currently running in mock guest mode
 */
export const isMockSession = async () => {
    const token = await getAccessToken();
    return token === 'mock-guest-token';
};

/**
 * Get refresh token (deprecated in single-token flow)
 */
export const getRefreshToken = async () => {
    return null;
};

/**
 * Clear all tokens (logout)
 */
export const clearTokens = async () => {
    try {
        await storage.removeItem(KEYS.AUTH_TOKEN);
        await storage.removeItem(KEYS.USER_DATA);

    } catch (error) {
        console.error('Error clearing tokens:', error);
    }
};



/**
 * Save user data
 */
export const saveUserData = async (userData) => {
    try {
        await storage.setItem(KEYS.USER_DATA, JSON.stringify(userData));
    } catch (error) {
        console.error('Error saving user data:', error);
    }
};

/**
 * Get user data
 */
export const getUserData = async () => {
    try {
        const data = await storage.getItem(KEYS.USER_DATA);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
};
