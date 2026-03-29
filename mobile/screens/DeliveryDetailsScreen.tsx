import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
    Button,
    SectionHeader,
    StatusBadge,
} from '../components/Common';
import DeliveryDetailSection from '../components/DeliveryDetailSection';
import {
    acceptAssignedDelivery,
    rejectAssignedDelivery,
    selectAssignedDeliveriesUpdating,
} from '../store/slices/assignedDeliveriesSlice';
import { colors, spacing, typography } from '../styles/theme';
import type { Delivery, DeliveryStatus } from '../types/delivery';
import {
    DeliveryWorkflowAction,
    DeliveryWorkflowStatus,
    canPerformAction,
    isWorkflowStatus,
} from '../utils/deliveryWorkflow';

type DeliveryDetailsScreenProps = {
    route: {
        params: {
            delivery: Delivery;
        };
    };
    navigation: {
        goBack: () => void;
        navigate: (screen: string, params?: Record<string, unknown>) => void;
    };
};

const formatStatus = (status: DeliveryStatus) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const toneForStatus = (status: DeliveryStatus) => {
    if (['accepted', 'picked_up', 'in_transit', 'delivered'].includes(status)) {
        return 'success' as const;
    }
    if (['assigned', 'arrived_at_pickup', 'arrived_at_dropoff'].includes(status)) {
        return 'info' as const;
    }
    if (['failed', 'cancelled'].includes(status)) {
        return 'danger' as const;
    }
    return 'warning' as const;
};

const formatCurrency = (value: number | null) => `$${Number(value || 0).toFixed(2)}`;

export default function DeliveryDetailsScreen({
    route,
    navigation,
}: DeliveryDetailsScreenProps) {
    const dispatch = useDispatch();
    const isUpdating = useSelector(selectAssignedDeliveriesUpdating);
    const { delivery } = route.params;
    const workflowStatus = isWorkflowStatus(delivery.status)
        ? delivery.status
        : null;
    const canAccept = workflowStatus
        ? canPerformAction(workflowStatus, DeliveryWorkflowAction.ACCEPT)
        : false;
    const canReject = workflowStatus
        ? canPerformAction(workflowStatus, DeliveryWorkflowAction.REJECT)
        : false;

    const handleAccept = async () => {
        const result = await dispatch(acceptAssignedDelivery(delivery.id) as any);
        if (acceptAssignedDelivery.fulfilled.match(result)) {
            navigation.navigate('ActiveDelivery', {
                job: { ...delivery, status: DeliveryWorkflowStatus.ACCEPTED },
            });
        }
    };

    const handleReject = () => {
        Alert.alert(
            'Reject Delivery',
            `Reject ${delivery.orderNumber} and return it to dispatch?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await dispatch(
                            rejectAssignedDelivery(delivery.id) as any
                        );
                        if (rejectAssignedDelivery.fulfilled.match(result)) {
                            navigation.goBack();
                        }
                    },
                },
            ]
        );
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            <SectionHeader
                eyebrow="Delivery Details"
                title={delivery.orderNumber}
                subtitle="Review the full order before taking action."
                right={
                    <StatusBadge
                        label={formatStatus(delivery.status)}
                        tone={toneForStatus(delivery.status)}
                    />
                }
            />

            <DeliveryDetailSection title="Order ID">
                <Text style={styles.primaryText}>{delivery.orderNumber}</Text>
            </DeliveryDetailSection>

            <DeliveryDetailSection title="Pickup Information">
                <Text style={styles.primaryText}>{delivery.pickupAddress}</Text>
                {delivery.pickupContactName ? (
                    <Text style={styles.secondaryText}>
                        Contact: {delivery.pickupContactName}
                    </Text>
                ) : null}
                {delivery.pickupContactPhone ? (
                    <Text style={styles.secondaryText}>
                        Phone: {delivery.pickupContactPhone}
                    </Text>
                ) : null}
                {delivery.etaMinutes ? (
                    <Text style={styles.metaText}>ETA: {delivery.etaMinutes} min</Text>
                ) : null}
            </DeliveryDetailSection>

            <DeliveryDetailSection title="Customer / Drop-off Information">
                <Text style={styles.primaryText}>{delivery.dropoffAddress}</Text>
                <Text style={styles.secondaryText}>Customer: {delivery.customerName}</Text>
                <Text style={styles.secondaryText}>Phone: {delivery.customerPhone}</Text>
            </DeliveryDetailSection>

            <DeliveryDetailSection title="Item Details">
                <Text style={styles.primaryText}>
                    {delivery.itemSummary || 'No item details provided'}
                </Text>
                <Text style={styles.metaText}>Payout: {formatCurrency(delivery.paymentAmount)}</Text>
                {delivery.distanceKm ? (
                    <Text style={styles.metaText}>
                        Distance: {delivery.distanceKm.toFixed(1)} km
                    </Text>
                ) : null}
            </DeliveryDetailSection>

            <DeliveryDetailSection title="Special Instructions">
                <Text style={styles.primaryText}>
                    {delivery.specialInstructions || 'No special instructions'}
                </Text>
            </DeliveryDetailSection>

            <DeliveryDetailSection title="Current Status">
                <Text style={styles.primaryText}>{formatStatus(delivery.status)}</Text>
                {delivery.assignedAt ? (
                    <Text style={styles.metaText}>
                        Assigned: {new Date(delivery.assignedAt).toLocaleString()}
                    </Text>
                ) : null}
                {delivery.acceptedAt ? (
                    <Text style={styles.metaText}>
                        Accepted: {new Date(delivery.acceptedAt).toLocaleString()}
                    </Text>
                ) : null}
            </DeliveryDetailSection>

            {canAccept || canReject ? (
                <View style={styles.actionRow}>
                    {canReject ? (
                        <Button
                            title="Reject"
                            variant="outline"
                            onPress={handleReject}
                            disabled={isUpdating}
                            style={styles.actionButton}
                            textStyle={styles.buttonText}
                        />
                    ) : null}
                    {canAccept ? (
                        <Button
                            title="Accept"
                            onPress={handleAccept}
                            disabled={isUpdating}
                            style={styles.actionButton}
                            textStyle={styles.buttonText}
                        />
                    ) : null}
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing.xl,
    },
    primaryText: {
        ...typography.body,
        color: colors.text,
    },
    secondaryText: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
    metaText: {
        ...typography.bodySmall,
        color: colors.primary,
        fontWeight: '700',
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    actionButton: {
        flex: 1,
    },
});
