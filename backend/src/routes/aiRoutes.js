const express = require('express');
const aiController = require('../controllers/aiController');
const {
    protect,
    authorize,
    requireSchoolScope,
    requireTeacherResourceAccess
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/options', protect, authorize('Teacher'), requireSchoolScope, aiController.getOptions);
router.get('/drafts', protect, authorize('Teacher'), requireSchoolScope, aiController.getMyDrafts);
router.get('/published', protect, authorize('Teacher'), requireSchoolScope, aiController.getMyPublished);

router.post('/generate/quiz', protect, authorize('Teacher'), requireSchoolScope, requireTeacherResourceAccess, aiController.generateQuiz);
router.get('/quizzes/:id', protect, authorize('Teacher'), requireSchoolScope, aiController.getQuizDraft);
router.put('/quizzes/:id', protect, authorize('Teacher'), requireSchoolScope, aiController.updateQuizDraft);
router.post('/quizzes/:id/regenerate', protect, authorize('Teacher'), requireSchoolScope, aiController.regenerateQuiz);
router.post('/quizzes/:id/publish', protect, authorize('Teacher'), requireSchoolScope, aiController.publishQuiz);

router.post('/generate/content', protect, authorize('Teacher'), requireSchoolScope, requireTeacherResourceAccess, aiController.generateContent);
router.get('/resources/:id', protect, authorize('Teacher'), requireSchoolScope, aiController.getContentDraft);
router.put('/resources/:id', protect, authorize('Teacher'), requireSchoolScope, aiController.updateContentDraft);
router.delete('/resources/:id', protect, authorize('Teacher'), requireSchoolScope, aiController.deleteContent);
router.post('/resources/:id/regenerate', protect, authorize('Teacher'), requireSchoolScope, aiController.regenerateContent);
router.post('/resources/:id/publish', protect, authorize('Teacher'), requireSchoolScope, aiController.publishContent);

router.get('/library', protect, authorize('SchoolAdmin', 'Teacher', 'Student', 'Parent', 'ContentManager'), requireSchoolScope, aiController.getPublishedLibrary);
router.get('/library/:id', protect, authorize('SchoolAdmin', 'Teacher', 'Student', 'Parent', 'ContentManager'), requireSchoolScope, aiController.viewLibraryResource);
router.get('/library/:id/download', protect, authorize('SchoolAdmin', 'Teacher', 'Student', 'Parent', 'ContentManager'), requireSchoolScope, aiController.downloadResource);

router.get('/admin/overview', protect, authorize('SuperAdmin', 'SchoolAdmin'), aiController.getAdminOverview);
router.get('/admin/usage', protect, authorize('SuperAdmin', 'SchoolAdmin'), aiController.getUsageLogs);
router.get('/admin/settings', protect, authorize('SuperAdmin', 'SchoolAdmin'), aiController.getAdminSettings);
router.put('/admin/settings', protect, authorize('SuperAdmin', 'SchoolAdmin'), aiController.updateAdminSettings);

module.exports = router;
