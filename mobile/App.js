import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Provider, useDispatch } from 'react-redux';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import DeliveryDetailsScreen from './screens/DeliveryDetailsScreen';
import AvailableJobsScreen from './screens/AvailableJobsScreen';
import ActiveDeliveryScreen from './screens/ActiveDeliveryScreen';
import AssignedDeliveriesScreen from './screens/AssignedDeliveriesScreen';
import ProofOfDeliveryScreen from './screens/ProofOfDeliveryScreen';
import JobHistoryScreen from './screens/JobHistoryScreen';
import ProfileScreen from './screens/ProfileScreen';

import { getAccessToken } from './services/storage';
import { requestLocationPermission } from './services/location';
import { colors, shadows } from './styles/theme';
import store from './store';
import { hydrateAvailability } from './store/slices/availabilitySlice';

const Stack = createStackNavigator();

const navTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        primary: colors.primary,
        border: colors.border,
    },
};

function AppContent() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const dispatch = useDispatch();

    useEffect(() => {
        checkAuth();
        requestLocationPermission();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await getAccessToken();
            const authenticated = !!token;
            setIsAuthenticated(authenticated);

            if (authenticated) {
                dispatch(hydrateAvailability());
            }
        } catch (error) {
            console.error('Auth check error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <>
            <StatusBar style="dark" />
            <NavigationContainer theme={navTheme}>
                <Stack.Navigator
                    screenOptions={{
                        headerStyle: styles.headerStyle,
                        headerTintColor: colors.text,
                        headerTitleStyle: styles.headerTitle,
                        headerTitleAlign: 'center',
                        headerShadowVisible: false,
                        cardStyle: { backgroundColor: colors.background },
                    }}
                    initialRouteName={isAuthenticated ? 'Home' : 'Login'}
                >
                    <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
                    <Stack.Screen
                        name="DeliveryDetails"
                        component={DeliveryDetailsScreen}
                        options={{ title: 'Delivery Details' }}
                    />
                    <Stack.Screen
                        name="AvailableJobs"
                        component={AvailableJobsScreen}
                        options={{ title: 'Available Jobs' }}
                    />
                    <Stack.Screen
                        name="AssignedDeliveries"
                        component={AssignedDeliveriesScreen}
                        options={{ title: 'Assigned Deliveries' }}
                    />
                    <Stack.Screen
                        name="ActiveDelivery"
                        component={ActiveDeliveryScreen}
                        options={{ title: 'Active Delivery' }}
                    />
                    <Stack.Screen
                        name="ProofOfDelivery"
                        component={ProofOfDeliveryScreen}
                        options={{ title: 'Proof of Delivery' }}
                    />
                    <Stack.Screen
                        name="JobHistory"
                        component={JobHistoryScreen}
                        options={{ title: 'Delivery History' }}
                    />
                    <Stack.Screen
                        name="Profile"
                        component={ProfileScreen}
                        options={{ title: 'My Profile' }}
                    />
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="Register"
                        component={RegisterScreen}
                        options={{ title: 'Create Account' }}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        </>
    );
}

export default function App() {
    return (
        <Provider store={store}>
            <AppContent />
        </Provider>
    );
}

const styles = StyleSheet.create({
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    headerStyle: {
        backgroundColor: colors.surface,
        ...shadows.small,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
    },
});
