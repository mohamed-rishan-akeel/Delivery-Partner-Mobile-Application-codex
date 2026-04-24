// API Configuration
// Change this to your main backend server URL (use your computer's local IP for testing)
export const API_BASE_URL = 'http://YOUR_LOCAL_IP:3000/api';

// For testing on physical device, use your computer's IP address:
// export const API_BASE_URL = 'http://192.168.1.XXX:3000/api';

// Admin API key for testing (matches backend .env)
export const ADMIN_API_KEY = 'test_admin_key_change_in_production';

// Token refresh settings
export const TOKEN_REFRESH_THRESHOLD = 60 * 1000; // Refresh 1 minute before expiry

// Route service configuration
export const ROUTE_PROVIDER = process.env.EXPO_PUBLIC_ROUTE_PROVIDER || 'mapbox';
export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
