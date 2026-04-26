-- Delivery Partner Database Schema

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS proof_of_delivery CASCADE;
DROP TABLE IF EXISTS job_tracking CASCADE;
DROP TABLE IF EXISTS delivery_request_offers CASCADE;
DROP TABLE IF EXISTS delivery_jobs CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS delivery_partners CASCADE;

-- Delivery Partners Table
CREATE TABLE delivery_partners (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50),
    vehicle_number VARCHAR(50),
    profile_photo_url TEXT,
    bio TEXT,
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    push_token TEXT,
    push_platform VARCHAR(20),
    push_token_updated_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    rating DECIMAL(3, 2) DEFAULT 0.00,
    total_deliveries INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh Tokens Table (for JWT authentication)
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery Jobs Table
CREATE TABLE delivery_jobs (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL,
    
    -- Job Details
    order_number VARCHAR(100) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    
    -- Pickup Information
    pickup_address TEXT NOT NULL,
    pickup_latitude DECIMAL(10, 8) NOT NULL,
    pickup_longitude DECIMAL(11, 8) NOT NULL,
    pickup_contact_name VARCHAR(255),
    pickup_contact_phone VARCHAR(20),
    
    -- Dropoff Information
    dropoff_address TEXT NOT NULL,
    dropoff_latitude DECIMAL(10, 8) NOT NULL,
    dropoff_longitude DECIMAL(11, 8) NOT NULL,
    
    -- Job Metadata
    distance_km DECIMAL(6, 2),
    payment_amount DECIMAL(10, 2) NOT NULL,
    items_description TEXT,
    special_instructions TEXT,
    
    -- Status Tracking
    status VARCHAR(30) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'accepted', 'arrived_at_pickup', 'picked_up', 'in_transit', 'arrived_at_dropoff', 'delivered', 'failed', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP,
    accepted_at TIMESTAMP,
    arrived_at_pickup_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    arrived_at_dropoff_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Status Logs Table (for history and audit)
CREATE TABLE job_status_logs (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
    partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL,
    reason TEXT, -- For 'failed' or 'cancelled' status
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Tracking Table (GPS location history)
CREATE TABLE job_tracking (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
    partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    speed DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proof of Delivery Table
CREATE TABLE proof_of_delivery (
    id SERIAL PRIMARY KEY,
    job_id INTEGER UNIQUE NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
    partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
    
    -- Proof Data
    photo_url TEXT,
    signature_data TEXT, -- Base64 encoded signature image
    recipient_name VARCHAR(255),
    notes TEXT,
    
    -- Location at delivery
    delivery_latitude DECIMAL(10, 8),
    delivery_longitude DECIMAL(11, 8),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Realtime Dispatch Offers Table
CREATE TABLE delivery_request_offers (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
    partner_id INTEGER NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
    offer_status VARCHAR(20) NOT NULL CHECK (
        offer_status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')
    ),
    distance_to_pickup_km DECIMAL(8, 3),
    offered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    responded_at TIMESTAMP,
    response_reason TEXT
);

-- Indexes for Performance
CREATE INDEX idx_partners_email ON delivery_partners(email);
CREATE INDEX idx_partners_status ON delivery_partners(status);
CREATE INDEX idx_jobs_status ON delivery_jobs(status);
CREATE INDEX idx_jobs_partner ON delivery_jobs(partner_id);
CREATE INDEX idx_jobs_order_number ON delivery_jobs(order_number);
CREATE INDEX idx_tracking_job ON job_tracking(job_id);
CREATE INDEX idx_tracking_recorded_at ON job_tracking(recorded_at);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_partner ON refresh_tokens(partner_id);
CREATE INDEX idx_dispatch_offers_job_id ON delivery_request_offers(job_id);
CREATE INDEX idx_dispatch_offers_partner_id ON delivery_request_offers(partner_id);
CREATE INDEX idx_dispatch_offers_status ON delivery_request_offers(offer_status, expires_at);
CREATE UNIQUE INDEX idx_dispatch_single_pending_job
    ON delivery_request_offers(job_id)
    WHERE offer_status = 'pending';
CREATE UNIQUE INDEX idx_dispatch_single_pending_partner
    ON delivery_request_offers(partner_id)
    WHERE offer_status = 'pending';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_delivery_partners_updated_at BEFORE UPDATE ON delivery_partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_jobs_updated_at BEFORE UPDATE ON delivery_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
