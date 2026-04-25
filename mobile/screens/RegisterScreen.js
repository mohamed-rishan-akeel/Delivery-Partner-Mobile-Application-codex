import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { Button, Input, SurfaceCard, StatusBadge } from '../components/Common';
import { authAPI } from '../services/api';
import { saveToken, saveUserData } from '../services/storage';
import { colors, spacing, typography, radii } from '../styles/theme';

export default function RegisterScreen({ navigation }) {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        vehicleType: '',
        vehicleNumber: '',
    });
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!formData.fullName || !formData.email || !formData.phone || !formData.password) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.register({
                ...formData,
                name: formData.fullName
            });
            const { user, token } = response.data.data;

            await saveToken(token);
            await saveUserData(user);

            Alert.alert('Success', 'Account created successfully!', [
                { text: 'OK', onPress: () => navigation.replace('MainTabs') }
            ]);
        } catch (error) {
            Alert.alert(
                'Registration Failed',
                error.response?.data?.message || 'Please try again'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <StatusBadge label="New Partner" tone="warning" />
                    <Text style={styles.title}>Create a driver profile that feels ready on day one.</Text>
                    <Text style={styles.subtitle}>
                        Set up your account, vehicle details, and secure credentials to join the delivery network.
                    </Text>
                </View>

                <SurfaceCard style={styles.formCard}>
                    <Text style={styles.formTitle}>Create Account</Text>
                    <Text style={styles.formSubtitle}>Required fields are marked and saved securely.</Text>

                    <Input
                        label="Full Name"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                    />
                    <Input
                        label="Email"
                        placeholder="partner@delivery.com"
                        value={formData.email}
                        onChangeText={(text) => setFormData({ ...formData, email: text })}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <Input
                        label="Phone"
                        placeholder="Enter your phone number"
                        value={formData.phone}
                        onChangeText={(text) => setFormData({ ...formData, phone: text })}
                        keyboardType="phone-pad"
                    />
                    <Input
                        label="Password"
                        placeholder="Create a password"
                        value={formData.password}
                        onChangeText={(text) => setFormData({ ...formData, password: text })}
                        secureTextEntry
                    />
                    <Input
                        label="Vehicle Type"
                        placeholder="Motorcycle, car, bicycle"
                        value={formData.vehicleType}
                        onChangeText={(text) => setFormData({ ...formData, vehicleType: text })}
                    />
                    <Input
                        label="Vehicle Number"
                        placeholder="Registration or identifier"
                        value={formData.vehicleNumber}
                        onChangeText={(text) => setFormData({ ...formData, vehicleNumber: text })}
                    />

                    <Button
                        title="Create Account"
                        onPress={handleRegister}
                        loading={loading}
                        style={styles.primaryAction}
                    />

                    <Button
                        title="Back to Sign In"
                        onPress={() => navigation.goBack()}
                        variant="outline"
                    />
                </SurfaceCard>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.lg,
    },
    hero: {
        backgroundColor: colors.primaryDark,
        borderRadius: radii.xl,
        padding: spacing.xl,
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.h1,
        color: colors.surface,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: 'rgba(255,255,255,0.82)',
    },
    formCard: {
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    formTitle: {
        ...typography.h2,
        marginBottom: spacing.xs,
    },
    formSubtitle: {
        ...typography.bodySmall,
        marginBottom: spacing.lg,
    },
    primaryAction: {
        marginBottom: spacing.sm,
    },
});
