import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { jobsAPI } from './api';

let locationSubscription = null;
let currentJobId = null;

/**
 * Request location permissions
 */
export const requestLocationPermission = async () => {
    // Skip location permissions on web
    if (Platform.OS === 'web') {
        console.log('Skipping location permissions on web');
        return true;
    }

    try {
        const { status: foregroundStatus } =
            await Location.requestForegroundPermissionsAsync();

        if (foregroundStatus !== 'granted') {
            throw new Error('Foreground location permission denied');
        }

        const { status: backgroundStatus } =
            await Location.requestBackgroundPermissionsAsync();

        if (backgroundStatus !== 'granted') {
            console.warn('Background location permission denied');
            // Still allow app to work with foreground only
        }

        return true;
    } catch (error) {
        console.error('Error requesting location permissions:', error);
        return false;
    }
};

/**
 * Get current location
 */
export const getCurrentLocation = async () => {
    try {
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            speed: location.coords.speed,
            heading: location.coords.heading,
        };
    } catch (error) {
        console.error('Error getting current location:', error);
        throw error;
    }
};

/**
 * Start tracking location for a job
 */
export const startLocationTracking = async (jobId) => {
    try {
        // Stop any existing tracking
        await stopLocationTracking();

        currentJobId = jobId;

        // Start watching position
        locationSubscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 10000, // Update every 10 seconds
                distanceInterval: 50, // Or every 50 meters
            },
            async (location) => {
                if (currentJobId) {
                    try {
                        await jobsAPI.addLocation(currentJobId, {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                            accuracy: location.coords.accuracy,
                            speed: location.coords.speed,
                            heading: location.coords.heading,
                        });
                    } catch (error) {
                        console.error('Error sending location update:', error);
                        // Don't throw - continue tracking even if one update fails
                    }
                }
            }
        );

        console.log('Location tracking started for job:', jobId);
    } catch (error) {
        console.error('Error starting location tracking:', error);
        throw error;
    }
};

/**
 * Stop location tracking
 */
export const stopLocationTracking = async () => {
    if (locationSubscription) {
        locationSubscription.remove();
        locationSubscription = null;
        currentJobId = null;
        console.log('Location tracking stopped');
    }
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
};
