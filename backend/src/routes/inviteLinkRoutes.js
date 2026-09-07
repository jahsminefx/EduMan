const express = require('express');
const router = express.Router();
const inviteLinkController = require('../controllers/inviteLinkController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

// Public Endpoints (No auth required)
router.get('/info/:code', inviteLinkController.getInviteInfo);
router.post('/register', inviteLinkController.registerViaInvite);

// School Admin Endpoints (Protected)
router.post('/', protect, authorize('SchoolAdmin'), requireSchoolScope, inviteLinkController.createInviteLink);
router.get('/', protect, authorize('SchoolAdmin'), requireSchoolScope, inviteLinkController.getInviteLinks);
router.delete('/:id', protect, authorize('SchoolAdmin'), requireSchoolScope, inviteLinkController.revokeInviteLink);

module.exports = router;
