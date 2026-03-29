import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens, isMockSession } from './storage';

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 3000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let refreshSubscribers = [];
let hasWarnedMockProfile = false;

/**
 * Subscribe to token refresh
 */
const subscribeTokenRefresh = (callback) => {
    refreshSubscribers.push(callback);
};

/**
 * Notify all subscribers when token is refreshed
 */
const onTokenRefreshed = (newAccessToken) => {
    refreshSubscribers.forEach((callback) => callback(null, newAccessToken));
    refreshSubscribers = [];
};

/**
 * Notify all subscribers when token refresh fails
 */
const onRefreshFailed = (error) => {
    refreshSubscribers.forEach((callback) => callback(error));
    refreshSubscribers = [];
};

/**
 * Request interceptor - Add access token to headers
 */
api.interceptors.request.use(
    async (config) => {
        const token = await getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Response interceptor - Handle token refresh on 401/403
 */
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is 401/403 and we haven't tried to refresh yet
        if (
            (error.response?.status === 401 || error.response?.status === 403) &&
            !originalRequest._retry
        ) {
            if (isRefreshing) {
                // Wait for the ongoing refresh to complete
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh((err, newAccessToken) => {
                        if (err) {
                            return reject(err);
                        }
                        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                        resolve(api(originalRequest));
                    });
                });
            }

            // Don't attempt to refresh if using the mock token
            const token = await getAccessToken();
            if (token === 'mock-guest-token') {
                return Promise.reject(error);
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = await getRefreshToken();

                if (!refreshToken) {
                    // No refresh token, user needs to login again
                    await clearTokens();
                    throw new Error('No refresh token available');
                }

                // Call refresh endpoint
                const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                    refreshToken,
                });

                const { accessToken } = response.data.data;

                // Save new access token
                await saveTokens(accessToken, refreshToken);

                // Update authorization header
                api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;

                // Notify all waiting requests
                onTokenRefreshed(accessToken);

                isRefreshing = false;

                // Retry original request
                return api(originalRequest);
            } catch (refreshError) {
                isRefreshing = false;
                onRefreshFailed(refreshError);
                await clearTokens();
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Mock data for Guest Mode
let mockProfileData = {
    id: 'guest-profile',
    full_name: 'Guest Delivery Partner',
    email: 'guest@example.com',
    phone: '+1 234 567 8900',
    status: 'online',
    vehicle_type: 'Bicycle',
    vehicle_number: 'GUEST-001',
    total_deliveries: 42,
    rating: 4.8,
    profile_photo_url: '',
    bio: 'Reliable city courier with a strong focus on on-time handoff and customer communication.',
    address: 'New York, NY',
    emergency_contact_name: 'Jordan Lee',
    emergency_contact_phone: '+1 917 555 0102',
};

const buildMockProfileResponse = () => ({
    data: {
        data: { ...mockProfileData },
    },
});

const buildMockStatusResponse = (status) => ({
    data: {
        success: true,
        message: 'Status updated successfully',
        data: { status },
    },
});

const MOCK_ACTIVE_JOB = {
    data: {
        data: {
            id: 101,
            order_number: 'DLV-24018',
            customer_name: 'Ava Thompson',
            customer_phone: '+1 212 555 0144',
            pickup_address: '18 Spring St, New York, NY',
            pickup_latitude: 40.7224,
            pickup_longitude: -73.9971,
            pickup_contact_name: 'Luis',
            pickup_contact_phone: '+1 212 555 0109',
            dropoff_address: '245 W 21st St, New York, NY',
            dropoff_latitude: 40.7446,
            dropoff_longitude: -73.9984,
            distance_km: 4.2,
            payment_amount: 18.5,
            items_description: '2 grocery bags and pharmacy order',
            special_instructions: 'Call on arrival. Leave with doorman if unavailable.',
            status: 'in_transit',
            assigned_at: new Date().toISOString(),
        },
    },
};

const MOCK_ASSIGNED_JOBS = {
    data: {
        data: [
            {
                id: 102,
                order_number: 'DLV-24021',
                customer_name: 'Noah Patel',
                customer_phone: '+1 646 555 0132',
                pickup_address: '75 Delancey St, New York, NY',
                pickup_latitude: 40.7185,
                pickup_longitude: -73.9882,
                pickup_contact_name: 'Tina',
                pickup_contact_phone: '+1 646 555 0104',
                dropoff_address: '300 E 34th St, New York, NY',
                dropoff_latitude: 40.7465,
                dropoff_longitude: -73.9741,
                distance_km: 5.8,
                payment_amount: 21.75,
                items_description: 'Restaurant pickup',
                special_instructions: 'Pick up from side entrance.',
                status: 'assigned',
                pickup_eta_minutes: 8,
            },
            {
                id: 103,
                order_number: 'DLV-24022',
                customer_name: 'Mia Rivera',
                customer_phone: '+1 718 555 0188',
                pickup_address: '410 Lafayette St, New York, NY',
                pickup_latitude: 40.7297,
                pickup_longitude: -73.9926,
                pickup_contact_name: 'Arun',
                pickup_contact_phone: '+1 718 555 0111',
                dropoff_address: '12 E 14th St, New York, NY',
                dropoff_latitude: 40.7348,
                dropoff_longitude: -73.9922,
                distance_km: 2.9,
                payment_amount: 14.25,
                items_description: 'Flower bouquet',
                special_instructions: 'Handle with care.',
                status: 'accepted',
                pickup_eta_minutes: 15,
            },
        ],
    },
};

const MOCK_JOBS = {
    data: {
        data: []
    }
};

// API methods
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
};

export const partnerAPI = {
    getProfile: async () => {
        try {
            return await api.get('/partner/profile');
        } catch (error) {
            if (!hasWarnedMockProfile) {
                console.warn('Backend unavailable, using mock profile');
                hasWarnedMockProfile = true;
            }
            return buildMockProfileResponse();
        }
    },
    updateProfile: async (data) => {
        try {
            return await api.put('/partner/profile', data);
        } catch (error) {
            mockProfileData = {
                ...mockProfileData,
                full_name: data.fullName ?? mockProfileData.full_name,
                phone: data.phone ?? mockProfileData.phone,
                vehicle_type: data.vehicleType ?? mockProfileData.vehicle_type,
                vehicle_number: data.vehicleNumber ?? mockProfileData.vehicle_number,
                profile_photo_url:
                    data.profilePhotoUrl !== undefined
                        ? data.profilePhotoUrl
                        : mockProfileData.profile_photo_url,
                bio: data.bio !== undefined ? data.bio : mockProfileData.bio,
                address: data.address !== undefined ? data.address : mockProfileData.address,
                emergency_contact_name:
                    data.emergencyContactName !== undefined
                        ? data.emergencyContactName
                        : mockProfileData.emergency_contact_name,
                emergency_contact_phone:
                    data.emergencyContactPhone !== undefined
                        ? data.emergencyContactPhone
                        : mockProfileData.emergency_contact_phone,
            };

            return {
                data: {
                    success: true,
                    message: 'Profile updated successfully',
                    data: { ...mockProfileData },
                },
            };
        }
    },
    deleteProfile: async () => {
        try {
            return await api.delete('/partner/profile');
        } catch (error) {
            mockProfileData = {
                ...mockProfileData,
                full_name: 'Deleted Partner',
                email: '',
                phone: '',
                vehicle_type: '',
                vehicle_number: '',
                profile_photo_url: '',
                bio: '',
                address: '',
                emergency_contact_name: '',
                emergency_contact_phone: '',
                total_deliveries: 0,
                rating: 0,
                status: 'offline',
            };

            return {
                data: {
                    success: true,
                    message: 'Profile deleted successfully',
                },
            };
        }
    },
    updateStatus: async (status) => {
        try {
            return await api.put('/partner/status', { status });
        } catch (error) {
            const mockSession = await isMockSession();
            const refreshToken = await getRefreshToken();
            const statusCode = error?.response?.status;
            const shouldFallbackToMock =
                mockSession ||
                !error?.response ||
                ((statusCode === 401 || statusCode === 403) && !refreshToken);

            if (!shouldFallbackToMock) {
                throw error;
            }

            mockProfileData = {
                ...mockProfileData,
                status,
            };

            return buildMockStatusResponse(status);
        }
    },
    updateLocation: (latitude, longitude) =>
        api.put('/partner/location', { latitude, longitude }),
};

export const jobsAPI = {
    getAvailable: async () => {
        try {
            return await api.get('/jobs/available');
        } catch (error) {
            return MOCK_JOBS;
        }
    },
    getActive: async () => {
        try {
            return await api.get('/jobs/active');
        } catch (error) {
            return MOCK_ACTIVE_JOB;
        }
    },
    getAssigned: async () => {
        try {
            return await api.get('/jobs/assigned');
        } catch (error) {
            return MOCK_ASSIGNED_JOBS;
        }
    },
    getHistory: async (limit = 20, offset = 0) => {
        try {
            return await api.get(`/jobs/history?limit=${limit}&offset=${offset}`);
        } catch (error) {
            return MOCK_JOBS;
        }
    },
    acceptJob: (jobId) => api.post(`/jobs/${jobId}/accept`),
    acceptAssigned: async (jobId) => {
        try {
            return await api.put(`/jobs/${jobId}/status`, { status: 'accepted' });
        } catch (error) {
            const updated = MOCK_ASSIGNED_JOBS.data.data.find((job) => job.id === jobId);
            if (updated) {
                updated.status = 'accepted';
                updated.accepted_at = new Date().toISOString();
            }
            return {
                data: {
                    success: true,
                    data: updated || null,
                },
            };
        }
    },
    rejectAssigned: async (jobId) => {
        try {
            return await api.post(`/jobs/${jobId}/reject`);
        } catch (error) {
            MOCK_ASSIGNED_JOBS.data.data = MOCK_ASSIGNED_JOBS.data.data.filter(
                (job) => job.id !== jobId
            );
            return {
                data: {
                    success: true,
                    data: { id: jobId },
                },
            };
        }
    },
    updateStatus: (jobId, status, extraData = {}) =>
        api.put(`/jobs/${jobId}/status`, { status, ...extraData }).catch(async (error) => {
            if (!(await isMockSession())) {
                throw error;
            }

            if (MOCK_ACTIVE_JOB.data.data?.id === jobId) {
                MOCK_ACTIVE_JOB.data.data = {
                    ...MOCK_ACTIVE_JOB.data.data,
                    status,
                };
            }

            const assigned = MOCK_ASSIGNED_JOBS.data.data.find((job) => job.id === jobId);
            if (assigned) {
                assigned.status = status;
            }

            return {
                data: {
                    success: true,
                    data: { id: jobId, status },
                },
            };
        }),
    addLocation: (jobId, locationData) =>
        api.post(`/jobs/${jobId}/location`, locationData).catch(async (error) => {
            if (!(await isMockSession())) {
                throw error;
            }

            return {
                data: {
                    success: true,
                    message: 'Mock location tracked successfully',
                    data: { jobId },
                },
            };
        }),
    submitProof: (jobId, proofData) =>
        api.post(`/jobs/${jobId}/proof`, proofData).catch(async (error) => {
            if (!(await isMockSession())) {
                throw error;
            }

            return {
                data: {
                    success: true,
                    message: 'Mock proof submitted successfully',
                    data: { jobId },
                },
            };
        }),
};

export default api;
