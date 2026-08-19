const express = require('express');
const router = express.Router();
const multer = require('multer');
const studentController = require('../controllers/studentController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
});

router.get('/', protect, requireSchoolScope, studentController.getStudents);
router.get('/me', protect, authorize('Student'), requireSchoolScope, studentController.getMyStudentProfile);
router.get('/parents/search', protect, authorize('SchoolAdmin', 'SuperAdmin'), requireSchoolScope, studentController.searchParents);
router.post('/bulk-upload', protect, authorize('SchoolAdmin'), requireSchoolScope, csvUpload.single('file'), studentController.bulkUploadStudents);
router.post('/', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, studentController.createStudent);
router.put('/:id', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, studentController.updateStudent);
router.delete('/:id', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, studentController.deleteStudent);

module.exports = router;
