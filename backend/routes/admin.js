const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const { dispatchJobToNextEligibleDriver } = require('../services/realtimeDispatch');

const router = express.Router();

// All routes require admin API key
router.use(authenticateAdmin);

/**
 * POST /api/admin/jobs
 * Create a new delivery job (for testing)
 */
router.post(
    '/jobs',
    [
        body('orderNumber').trim().notEmpty(),
        body('customerName').trim().notEmpty(),
        body('customerPhone').trim().notEmpty(),
        body('pickupAddress').trim().notEmpty(),
        body('pickupLatitude').isFloat({ min: -90, max: 90 }),
        body('pickupLongitude').isFloat({ min: -180, max: 180 }),
        body('dropoffAddress').trim().notEmpty(),
        body('dropoffLatitude').isFloat({ min: -90, max: 90 }),
        body('dropoffLongitude').isFloat({ min: -180, max: 180 }),
        body('paymentAmount').isFloat({ min: 0 }),
        body('itemsDescription').optional().trim(),
        body('specialInstructions').optional().trim(),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
            }

            const {
                orderNumber,
                customerName,
                customerPhone,
                pickupAddress,
                pickupLatitude,
                pickupLongitude,
                pickupContactName,
                pickupContactPhone,
                dropoffAddress,
                dropoffLatitude,
                dropoffLongitude,
                distanceKm,
                paymentAmount,
                itemsDescription,
                specialInstructions,
            } = req.body;

            const result = await query(
                `INSERT INTO delivery_jobs (
          order_number, customer_name, customer_phone,
          pickup_address, pickup_latitude, pickup_longitude,
          pickup_contact_name, pickup_contact_phone,
          dropoff_address, dropoff_latitude, dropoff_longitude,
          distance_km, payment_amount, items_description, special_instructions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, order_number, status, created_at`,
                [
                    orderNumber,
                    customerName,
                    customerPhone,
                    pickupAddress,
                    pickupLatitude,
                    pickupLongitude,
                    pickupContactName || null,
                    pickupContactPhone || null,
                    dropoffAddress,
                    dropoffLatitude,
                    dropoffLongitude,
                    distanceKm || null,
                    paymentAmount,
                    itemsDescription || null,
                    specialInstructions || null,
                ]
            );

            await dispatchJobToNextEligibleDriver(result.rows[0].id);

            res.status(201).json({
                success: true,
                message: 'Job created and dispatch started successfully',
                data: result.rows[0],
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/admin/jobs
 * Get all jobs with optional status filter
 */
router.get('/jobs', async (req, res, next) => {
    try {
        const { status } = req.query;
        let queryText = `
      SELECT j.*, p.full_name as partner_name, p.phone as partner_phone
      FROM delivery_jobs j
      LEFT JOIN delivery_partners p ON j.partner_id = p.id
    `;
        const params = [];

        if (status) {
            queryText += ' WHERE j.status = $1';
            params.push(status);
        }

        queryText += ' ORDER BY j.created_at DESC';

        const result = await query(queryText, params);

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/partners
 * Get all delivery partners
 */
router.get('/partners', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, email, full_name, phone, vehicle_type, vehicle_number,
      status, current_latitude, current_longitude, rating, total_deliveries,
      created_at
      FROM delivery_partners
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
 * GET /api/admin/jobs/:id/tracking
 * Get GPS tracking history for a job
 */
router.get('/jobs/:id/tracking', async (req, res, next) => {
    try {
        const jobId = parseInt(req.params.id);

        const result = await query(
            `SELECT latitude, longitude, accuracy, speed, heading, recorded_at
      FROM job_tracking
      WHERE job_id = $1
      ORDER BY recorded_at ASC`,
            [jobId]
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
