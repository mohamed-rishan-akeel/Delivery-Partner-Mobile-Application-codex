import type { Delivery } from './delivery';

export type RootStackParamList = {
    Home: undefined;
    DeliveryDetails: { delivery: Delivery };
    ActiveDelivery: { job: Delivery };
    AvailableJobs: undefined;
    AssignedDeliveries: undefined;
    ProofOfDelivery: { jobId?: Delivery['id'] } | undefined;
    JobHistory: undefined;
    Profile: undefined;
    Login: undefined;
    Register: undefined;
};
