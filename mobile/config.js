// API Configuration
// Change this to your backend server URL
export const API_BASE_URL = 'http://192.168.8.133:3000/api';

// For testing on physical device, use your computer's IP address:
// export const API_BASE_URL = 'http://192.168.1.XXX:3000/api';

// Admin API key for testing (matches backend .env)
export const ADMIN_API_KEY = 'test_admin_key_change_in_production';

// Token refresh settings
export const TOKEN_REFRESH_THRESHOLD = 60 * 1000; // Refresh 1 minute before expiry
