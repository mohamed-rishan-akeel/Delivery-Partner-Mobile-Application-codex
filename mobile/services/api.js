import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAccessToken, saveToken, clearTokens, isMockSession } from './storage';

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 3000,
    headers: {
        'Content-Type': 'application/json',
    },
});

let hasWarnedMockProfile = false;

/**
 * Request interceptor - Add token to headers
 */
api.interceptors.request.use(
    async (config) => {
        const token = await getAccessToken();
        if (token && token !== 'mock-guest-token') {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Response interceptor - Handle 401/403 errors
 */
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // If error is 401/403, we just clear tokens as we don't have refresh logic anymore
        if (error.response?.status === 401 || error.response?.status === 403) {
            const token = await getAccessToken();
            if (token !== 'mock-guest-token') {
                await clearTokens();
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
    phone: '+94 71 234 5678',
    status: 'online',
    vehicle_type: 'Motorbike',
    vehicle_number: 'WP CAB-4581',
    total_deliveries: 42,
    rating: 4.8,
    profile_photo_url: '',
    bio: 'Reliable Colombo courier focused on fast handoffs, careful handling, and clear customer updates.',
    address: 'Colombo 05, Sri Lanka',
    emergency_contact_name: 'Nadeesha Perera',
    emergency_contact_phone: '+94 77 123 4567',

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
            customer_name: 'Kasuni Silva',
            customer_phone: '+94 76 455 2201',
            pickup_address: 'Liberty Plaza, R. A. de Mel Mawatha, Colombo 03, Sri Lanka',
            pickup_latitude: 6.9134,
            pickup_longitude: 79.8505,
            pickup_contact_name: 'Ruwan',
            pickup_contact_phone: '+94 77 662 1100',
            dropoff_address: 'Marine Drive Apartments, Wellawatte, Colombo 06, Sri Lanka',
            dropoff_latitude: 6.8749,
            dropoff_longitude: 79.8607,
            distance_km: 5.3,
            payment_amount: 18.5,
            items_description: '2 grocery bags and one pharmacy parcel',
            special_instructions: 'Call on arrival and hand over at the main gate security desk.',
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
                customer_name: 'Dulanjan Fernando',
                customer_phone: '+94 71 884 1200',
                pickup_address: 'Pettah Market, Main Street, Colombo 11, Sri Lanka',
                pickup_latitude: 6.9361,
                pickup_longitude: 79.8507,
                pickup_contact_name: 'Tharushi',
                pickup_contact_phone: '+94 75 312 8860',
                dropoff_address: 'Parliament Road, Rajagiriya, Sri Lanka',
                dropoff_latitude: 6.9108,
                dropoff_longitude: 79.8956,
                distance_km: 7.1,
                payment_amount: 21.75,
                items_description: 'Restaurant family meal order',
                special_instructions: 'Collect from the side entrance next to the cashier counter.',
                status: 'assigned',
                pickup_eta_minutes: 12,
            },
            {
                id: 103,
                order_number: 'DLV-24022',
                customer_name: 'Shehani Jayawardena',
                customer_phone: '+94 77 908 4455',
                pickup_address: 'High Level Road, Nugegoda, Sri Lanka',
                pickup_latitude: 6.8651,
                pickup_longitude: 79.8997,
                pickup_contact_name: 'Ahamed',
                pickup_contact_phone: '+94 70 445 9012',
                dropoff_address: 'Hospital Road, Dehiwala, Sri Lanka',
                dropoff_latitude: 6.8517,
                dropoff_longitude: 79.8651,
                distance_km: 4.8,
                payment_amount: 14.25,
                items_description: 'Flower bouquet and gift bag',
                special_instructions: 'Handle with care and call before reaching the apartment gate.',
                status: 'accepted',
                pickup_eta_minutes: 10,
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
    logout: () => Promise.resolve({ data: { success: true } }), // Local only for JWT
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
            const statusCode = error?.response?.status;
            const shouldFallbackToMock =
                mockSession ||
                !error?.response ||
                (statusCode === 401 || statusCode === 403);

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
            const updatedIndex = MOCK_ASSIGNED_JOBS.data.data.findIndex((job) => job.id === jobId);
            const updated =
                updatedIndex >= 0 ? MOCK_ASSIGNED_JOBS.data.data[updatedIndex] : null;
            if (updated) {
                updated.status = 'accepted';
                updated.accepted_at = new Date().toISOString();
                MOCK_ACTIVE_JOB.data.data = {
                    ...updated,
                };
                MOCK_ASSIGNED_JOBS.data.data.splice(updatedIndex, 1);
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
