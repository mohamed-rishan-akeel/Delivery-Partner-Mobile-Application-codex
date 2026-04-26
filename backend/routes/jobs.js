const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, getClient } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const {
    dispatchAvailableJobs,
    resolveOffer,
} = require('../services/realtimeDispatch');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/jobs/available
 * Get list of available jobs (not assigned to anyone)
 */
router.get('/available', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, order_number, customer_name, customer_phone,
      pickup_address, pickup_latitude, pickup_longitude,
      dropoff_address, dropoff_latitude, dropoff_longitude,
      distance_km, payment_amount, items_description, special_instructions,
      status, created_at
      FROM delivery_jobs
      WHERE status = 'available'
        AND NOT EXISTS (
            SELECT 1
            FROM delivery_request_offers dro
            WHERE dro.job_id = delivery_jobs.id
              AND dro.offer_status = 'pending'
              AND dro.expires_at > NOW()
        )
      ORDER BY created_at DESC`,
            []
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/jobs/active
 * Get partner's currently active job
 */
router.get('/active', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, order_number, customer_name, customer_phone,
      pickup_address, pickup_latitude, pickup_longitude,
      pickup_contact_name, pickup_contact_phone,
      dropoff_address, dropoff_latitude, dropoff_longitude,
      distance_km, payment_amount, items_description, special_instructions,
      status, assigned_at, picked_up_at, created_at
      FROM delivery_jobs
      WHERE partner_id = $1 AND status IN ('assigned', 'picked_up', 'in_transit')
      ORDER BY assigned_at DESC
      LIMIT 1`,
            [req.user.id]
        );

        res.json({
            success: true,
            data: result.rows[0] || null,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/jobs/assigned
 * Get partner's assigned deliveries waiting for action or pickup
 */
router.get('/assigned', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, order_number, customer_name, customer_phone,
      pickup_address, pickup_latitude, pickup_longitude,
      pickup_contact_name, pickup_contact_phone,
      dropoff_address, dropoff_latitude, dropoff_longitude,
      distance_km, payment_amount, items_description, special_instructions,
      status, assigned_at, accepted_at, created_at
      FROM delivery_jobs
      WHERE partner_id = $1 AND status IN ('assigned', 'accepted')
      ORDER BY assigned_at DESC NULLS LAST, created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/jobs/history
 * Get partner's completed job history
 */
router.get('/history', async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const result = await query(
            `SELECT dj.id, dj.order_number, dj.customer_name,
      dj.pickup_address, dj.dropoff_address,
      dj.distance_km, dj.payment_amount,
      dj.status, dj.assigned_at, dj.picked_up_at, dj.delivered_at,
      pod.photo_url, pod.signature_data, pod.recipient_name,
      pod.notes, pod.created_at AS proof_submitted_at
      FROM delivery_jobs dj
      LEFT JOIN proof_of_delivery pod ON pod.job_id = dj.id
      WHERE dj.partner_id = $1 AND dj.status IN ('delivered', 'cancelled')
      ORDER BY dj.delivered_at DESC NULLS LAST, pod.created_at DESC NULLS LAST
      LIMIT $2 OFFSET $3`,
            [req.user.id, limit, offset]
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/jobs/request-offers/:offerId/accept
 * Accept an incoming realtime order request
 */
router.post('/request-offers/:offerId/accept', async (req, res, next) => {
    try {
        const offerId = parseInt(req.params.offerId);
        const result = await resolveOffer({
            offerId,
            partnerId: req.user.id,
            action: 'accepted',
            reason: 'driver_accepted_request',
        });

        if (!result.success) {
            return res.status(result.statusCode || 400).json({
                success: false,
                message: result.message,
            });
        }

        res.json({
            success: true,
            message: 'Incoming request accepted successfully',
            data: result.data,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/jobs/request-offers/:offerId/decline
 * Decline an incoming realtime order request
 */
router.post(
    '/request-offers/:offerId/decline',
    [body('reason').optional().trim()],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid decline payload',
                    errors: errors.array(),
                });
            }

            const offerId = parseInt(req.params.offerId);
            const result = await resolveOffer({
                offerId,
                partnerId: req.user.id,
                action: 'declined',
                reason: req.body.reason || 'driver_declined_request',
            });

            if (!result.success) {
                return res.status(result.statusCode || 400).json({
                    success: false,
                    message: result.message,
                });
            }

            res.json({
                success: true,
                message: 'Incoming request declined successfully',
                data: result.data,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/jobs/request-offers/:offerId/expire
 * Explicitly expire an incoming realtime order request from the client timer
 */
router.post('/request-offers/:offerId/expire', async (req, res, next) => {
    try {
        const offerId = parseInt(req.params.offerId);
        const result = await resolveOffer({
            offerId,
            partnerId: req.user.id,
            action: 'expired',
            reason: 'driver_timer_elapsed',
        });

        if (!result.success) {
            return res.status(result.statusCode || 400).json({
                success: false,
                message: result.message,
            });
        }

        res.json({
            success: true,
            message: 'Incoming request expired successfully',
            data: result.data,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/jobs/:id/accept
 * Accept an available job
 */
router.post('/:id/accept', async (req, res, next) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const jobId = parseInt(req.params.id);

        const pendingOfferCheck = await client.query(
            `SELECT id
             FROM delivery_request_offers
             WHERE job_id = $1
               AND offer_status = 'pending'
               AND expires_at > NOW()
             LIMIT 1`,
            [jobId]
        );

        if (pendingOfferCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'This job is already being offered to another driver',
            });
        }

        const partnerStatusCheck = await client.query(
            'SELECT status FROM delivery_partners WHERE id = $1',
            [req.user.id]
        );

        if (partnerStatusCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Partner not found',
            });
        }

        if (partnerStatusCheck.rows[0].status !== 'online') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'You must be online to accept a job',
            });
        }

        // Check if partner already has an active job
        const activeJobCheck = await client.query(
            `SELECT id FROM delivery_jobs 
      WHERE partner_id = $1 AND status IN ('assigned', 'picked_up', 'in_transit')`,
            [req.user.id]
        );

        if (activeJobCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'You already have an active delivery',
            });
        }

        // Try to assign the job (check if still available)
        const result = await client.query(
            `UPDATE delivery_jobs 
      SET partner_id = $1, status = 'assigned', assigned_at = NOW()
      WHERE id = $2 AND status = 'available'
      RETURNING id, order_number, customer_name, customer_phone,
      pickup_address, pickup_latitude, pickup_longitude,
      pickup_contact_name, pickup_contact_phone,
      dropoff_address, dropoff_latitude, dropoff_longitude,
      distance_km, payment_amount, items_description, special_instructions,
      status, assigned_at`,
            [req.user.id, jobId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'Job is no longer available',
            });
        }

        // Update partner status to busy
        await client.query(
            'UPDATE delivery_partners SET status = $1 WHERE id = $2',
            ['busy', req.user.id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Job accepted successfully',
            data: result.rows[0],
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

/**
 * POST /api/jobs/:id/reject
 * Reject an assigned delivery and return it to the available pool
 */
router.post('/:id/reject', async (req, res, next) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const jobId = parseInt(req.params.id);
        const rejectionCheck = await client.query(
            `SELECT id, status, partner_id
             FROM delivery_jobs
             WHERE id = $1`,
            [jobId]
        );

        if (rejectionCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Job not found',
            });
        }

        const job = rejectionCheck.rows[0];

        if (job.partner_id !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!['assigned', 'accepted'].includes(job.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Only assigned deliveries can be rejected',
            });
        }

        const result = await client.query(
            `UPDATE delivery_jobs
             SET partner_id = NULL,
                 status = 'available',
                 assigned_at = NULL,
                 accepted_at = NULL
             WHERE id = $1
             RETURNING id, order_number, status`,
            [jobId]
        );

        await client.query(
            'UPDATE delivery_partners SET status = $1 WHERE id = $2 AND status = $3',
            ['online', req.user.id, 'busy']
        );

        await client.query('COMMIT');

        await dispatchAvailableJobs();

        res.json({
            success: true,
            message: 'Assigned delivery rejected successfully',
            data: result.rows[0],
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

/**
 * PUT /api/jobs/:id/status
 * Update job status with transition validation and logging
 */
router.put(
    '/:id/status',
    [
        body('status').isIn([
            'accepted',
            'arrived_at_pickup',
            'picked_up',
            'in_transit',
            'arrived_at_dropoff',
            'delivered',
            'failed',
        ]),
        body('reason').optional().trim(),
        body('latitude').optional().isFloat(),
        body('longitude').optional().isFloat(),
    ],
    async (req, res, next) => {
        const client = await getClient();
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status update',
                    errors: errors.array(),
                });
            }

            const jobId = parseInt(req.params.id);
            const { status, reason, latitude, longitude } = req.body;

            await client.query('BEGIN');

            // 1. Get current job status to validate transition
            const currentJobRes = await client.query(
                'SELECT status, partner_id FROM delivery_jobs WHERE id = $1',
                [jobId]
            );

            if (currentJobRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Job not found' });
            }

            const currentStatus = currentJobRes.rows[0].status;
            const jobPartnerId = currentJobRes.rows[0].partner_id;

            // Verify authorization
            if (jobPartnerId !== req.user.id) {
                await client.query('ROLLBACK');
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }

            // 2. Validate Transition
            const transitions = {
                assigned: ['accepted', 'failed'],
                accepted: ['arrived_at_pickup', 'failed'],
                arrived_at_pickup: ['picked_up', 'failed'],
                picked_up: ['in_transit', 'failed'],
                in_transit: ['arrived_at_dropoff', 'failed'],
                arrived_at_dropoff: ['delivered', 'failed'],
            };

            if (status !== 'failed' && (!transitions[currentStatus] || !transitions[currentStatus].includes(status))) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Invalid transition from ${currentStatus} to ${status}`,
                });
            }

            // 3. Update Job status
            const timestampMap = {
                accepted: 'accepted_at',
                arrived_at_pickup: 'arrived_at_pickup_at',
                picked_up: 'picked_up_at',
                arrived_at_dropoff: 'arrived_at_dropoff_at',
                delivered: 'delivered_at',
                failed: 'failed_at',
            };

            const timestampField = timestampMap[status];
            const timestampSQL = timestampField ? `, ${timestampField} = NOW()` : '';

            const updateResult = await client.query(
                `UPDATE delivery_jobs 
                 SET status = $1 ${timestampSQL}
                 WHERE id = $2
                 RETURNING id, order_number, status`,
                [status, jobId]
            );

            // 4. Create Status Log
            await client.query(
                `INSERT INTO job_status_logs (job_id, partner_id, status, reason, latitude, longitude)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [jobId, req.user.id, status, reason || null, latitude || null, longitude || null]
            );

            // 5. Post-update effects
            if (status === 'delivered' || status === 'failed') {
                // Return partner to online status
                await client.query(
                    'UPDATE delivery_partners SET status = $1, total_deliveries = total_deliveries + (CASE WHEN $3 = \'delivered\' THEN 1 ELSE 0 END) WHERE id = $2',
                    ['online', req.user.id, status]
                );
            }

            await client.query('COMMIT');

            if (status === 'failed') {
                await dispatchAvailableJobs();
            }

            res.json({
                success: true,
                message: `Job status updated to ${status}`,
                data: updateResult.rows[0],
            });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
);

/**
 * POST /api/jobs/:id/location
 * Add GPS tracking point during delivery
 */
router.post(
    '/:id/location',
    [
        body('latitude').isFloat({ min: -90, max: 90 }),
        body('longitude').isFloat({ min: -180, max: 180 }),
        body('accuracy').optional().isFloat(),
        body('speed').optional().isFloat(),
        body('heading').optional().isFloat(),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid location data',
                    errors: errors.array(),
                });
            }

            const jobId = parseInt(req.params.id);
            const { latitude, longitude, accuracy, speed, heading } = req.body;

            // Verify job belongs to partner
            const jobCheck = await query(
                'SELECT id FROM delivery_jobs WHERE id = $1 AND partner_id = $2',
                [jobId, req.user.id]
            );

            if (jobCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found or not assigned to you',
                });
            }

            // Insert tracking point
            await query(
                `INSERT INTO job_tracking 
        (job_id, partner_id, latitude, longitude, accuracy, speed, heading)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [jobId, req.user.id, latitude, longitude, accuracy || null, speed || null, heading || null]
            );

            res.json({
                success: true,
                message: 'Location tracked successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/jobs/:id/proof
 * Submit proof of delivery
 */
router.post(
    '/:id/proof',
    [
        body('photoUrl').optional().isString().trim().notEmpty(),
        body('signatureData').optional().notEmpty(),
        body('recipientName').optional().trim(),
        body('notes').optional().trim(),
        body('latitude').optional().isFloat({ min: -90, max: 90 }),
        body('longitude').optional().isFloat({ min: -180, max: 180 }),
    ],
    async (req, res, next) => {
        const client = await getClient();
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
            }

            const jobId = parseInt(req.params.id);
            const { photoUrl, signatureData, recipientName, notes, latitude, longitude } = req.body;
            const proofReason = 'Proof of delivery submitted and archived';

            if (!photoUrl && !signatureData) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a delivery photo or signature',
                });
            }

            await client.query('BEGIN');

            // Verify job belongs to partner and is in correct status
            const jobCheck = await client.query(
                'SELECT id, order_number, status, delivered_at FROM delivery_jobs WHERE id = $1 AND partner_id = $2',
                [jobId, req.user.id]
            );

            if (jobCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'Job not found or not assigned to you',
                });
            }

            const job = jobCheck.rows[0];
            const canArchiveProof = ['in_transit', 'arrived_at_dropoff', 'delivered'].includes(job.status);

            if (!canArchiveProof) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: 'Proof can only be submitted when the delivery is ready to complete',
                });
            }

            // Insert or update proof of delivery so the archive stays attached to the job lifecycle.
            const proofResult = await client.query(
                `INSERT INTO proof_of_delivery
        (job_id, partner_id, photo_url, signature_data, recipient_name, notes, delivery_latitude, delivery_longitude)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (job_id)
        DO UPDATE SET
            photo_url = COALESCE(EXCLUDED.photo_url, proof_of_delivery.photo_url),
            signature_data = COALESCE(EXCLUDED.signature_data, proof_of_delivery.signature_data),
            recipient_name = COALESCE(EXCLUDED.recipient_name, proof_of_delivery.recipient_name),
            notes = COALESCE(EXCLUDED.notes, proof_of_delivery.notes),
            delivery_latitude = COALESCE(EXCLUDED.delivery_latitude, proof_of_delivery.delivery_latitude),
            delivery_longitude = COALESCE(EXCLUDED.delivery_longitude, proof_of_delivery.delivery_longitude)
        RETURNING id, photo_url, signature_data, recipient_name, notes, created_at`,
                [
                    jobId,
                    req.user.id,
                    photoUrl || null,
                    signatureData || null,
                    recipientName || null,
                    notes || null,
                    latitude || null,
                    longitude || null,
                ]
            );

            let deliveredAt = job.delivered_at;

            if (job.status !== 'delivered') {
                const deliveryResult = await client.query(
                    `UPDATE delivery_jobs
                     SET status = 'delivered',
                         delivered_at = NOW()
                     WHERE id = $1
                     RETURNING delivered_at`,
                    [jobId]
                );

                deliveredAt = deliveryResult.rows[0]?.delivered_at ?? null;

                await client.query(
                    `INSERT INTO job_status_logs (job_id, partner_id, status, reason, latitude, longitude)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        jobId,
                        req.user.id,
                        'delivered',
                        proofReason,
                        latitude || null,
                        longitude || null,
                    ]
                );

                await client.query(
                    `UPDATE delivery_partners
                     SET status = $1,
                         total_deliveries = total_deliveries + 1
                     WHERE id = $2`,
                    ['online', req.user.id]
                );
            }

            await client.query('COMMIT');

            await dispatchAvailableJobs();

            res.json({
                success: true,
                message: 'Delivery completed and proof archived successfully',
                data: {
                    id: jobId,
                    orderNumber: job.order_number,
                    status: 'delivered',
                    deliveredAt,
                    proof: proofResult.rows[0],
                },
            });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
);

module.exports = router;
