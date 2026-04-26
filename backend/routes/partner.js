const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const {
    cancelPendingOffersForPartner,
    dispatchAvailableJobs,
} = require('../services/realtimeDispatch');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/partner/profile
 * Get current partner profile
 */
router.get('/profile', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, email, full_name, phone, vehicle_type, vehicle_number,
      profile_photo_url, bio, address, emergency_contact_name, emergency_contact_phone,
      push_token, push_platform, push_token_updated_at,
      status, current_latitude, current_longitude, rating, total_deliveries,
      created_at, updated_at 
      FROM delivery_partners WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner not found',
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/partner/profile
 * Update partner profile
 */
router.put(
    '/profile',
    [
        body('fullName').optional().trim().notEmpty(),
        body('phone').optional().trim().notEmpty(),
        body('vehicleType').optional().trim(),
        body('vehicleNumber').optional().trim(),
        body('profilePhotoUrl').optional().trim(),
        body('bio').optional().trim(),
        body('address').optional().trim(),
        body('emergencyContactName').optional().trim(),
        body('emergencyContactPhone').optional().trim(),
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
                fullName,
                phone,
                vehicleType,
                vehicleNumber,
                profilePhotoUrl,
                bio,
                address,
                emergencyContactName,
                emergencyContactPhone,
            } = req.body;
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (fullName !== undefined) {
                updates.push(`full_name = $${paramCount++}`);
                values.push(fullName);
            }
            if (phone !== undefined) {
                updates.push(`phone = $${paramCount++}`);
                values.push(phone);
            }
            if (vehicleType !== undefined) {
                updates.push(`vehicle_type = $${paramCount++}`);
                values.push(vehicleType);
            }
            if (vehicleNumber !== undefined) {
                updates.push(`vehicle_number = $${paramCount++}`);
                values.push(vehicleNumber);
            }
            if (profilePhotoUrl !== undefined) {
                updates.push(`profile_photo_url = $${paramCount++}`);
                values.push(profilePhotoUrl || null);
            }
            if (bio !== undefined) {
                updates.push(`bio = $${paramCount++}`);
                values.push(bio || null);
            }
            if (address !== undefined) {
                updates.push(`address = $${paramCount++}`);
                values.push(address || null);
            }
            if (emergencyContactName !== undefined) {
                updates.push(`emergency_contact_name = $${paramCount++}`);
                values.push(emergencyContactName || null);
            }
            if (emergencyContactPhone !== undefined) {
                updates.push(`emergency_contact_phone = $${paramCount++}`);
                values.push(emergencyContactPhone || null);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update',
                });
            }

            values.push(req.user.id);

            const result = await query(
                `UPDATE delivery_partners SET ${updates.join(', ')} 
        WHERE id = $${paramCount} 
        RETURNING id, email, full_name, phone, vehicle_type, vehicle_number,
        profile_photo_url, bio, address, emergency_contact_name, emergency_contact_phone,
        push_token, push_platform, push_token_updated_at, status, rating, total_deliveries`,
                values
            );

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: result.rows[0],
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/partner/push-token
 * Save the device push token
 */
router.put(
    '/push-token',
    [
        body('pushToken').trim().notEmpty(),
        body('devicePlatform').optional().isIn(['android', 'ios', 'web', 'unknown']),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid push token payload',
                    errors: errors.array(),
                });
            }

            const { pushToken, devicePlatform = 'unknown' } = req.body;

            const result = await query(
                `UPDATE delivery_partners
         SET push_token = $1,
             push_platform = $2,
             push_token_updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING push_token, push_platform, push_token_updated_at`,
                [pushToken, devicePlatform, req.user.id]
            );

            res.json({
                success: true,
                message: 'Push token saved successfully',
                data: result.rows[0],
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/partner/profile
 * Delete partner account
 */
router.delete('/profile', async (req, res, next) => {
    try {
        const result = await query(
            'DELETE FROM delivery_partners WHERE id = $1 RETURNING id',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner not found',
            });
        }

        res.json({
            success: true,
            message: 'Profile deleted successfully',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/partner/status
 * Update partner availability status
 */
router.put(
    '/status',
    [body('status').isIn(['online', 'offline'])],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status. Must be "online" or "offline"',
                });
            }

            const { status } = req.body;

            const result = await query(
                'UPDATE delivery_partners SET status = $1 WHERE id = $2 RETURNING status',
                [status, req.user.id]
            );

            if (status === 'offline') {
                await cancelPendingOffersForPartner(req.user.id, 'partner_went_offline');
            } else {
                await dispatchAvailableJobs();
            }

            res.json({
                success: true,
                message: 'Status updated successfully',
                data: { status: result.rows[0].status },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/partner/location
 * Update current GPS location
 */
router.put(
    '/location',
    [
        body('latitude').isFloat({ min: -90, max: 90 }),
        body('longitude').isFloat({ min: -180, max: 180 }),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coordinates',
                    errors: errors.array(),
                });
            }

            const { latitude, longitude } = req.body;

            await query(
                'UPDATE delivery_partners SET current_latitude = $1, current_longitude = $2 WHERE id = $3',
                [latitude, longitude, req.user.id]
            );

            await dispatchAvailableJobs();

            res.json({
                success: true,
                message: 'Location updated successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;
