const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/', protect, requireSchoolScope, announcementController.listAnnouncements);
router.get('/:id', protect, requireSchoolScope, announcementController.getAnnouncement);
router.post('/', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, announcementController.createAnnouncement);
router.put('/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, announcementController.updateAnnouncement);
router.delete('/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, announcementController.deleteAnnouncement);

module.exports = router;
