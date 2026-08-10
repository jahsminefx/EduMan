const express = require('express');
const router = express.Router();
const kbController = require('../controllers/knowledgeBaseController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/articles', kbController.getArticles);
router.post('/articles', kbController.createArticle);
router.get('/articles/:slug', kbController.getArticleBySlug);
router.put('/articles/:id', kbController.updateArticle);
router.delete('/articles/:id', kbController.deleteArticle);
router.post('/articles/:id/bookmark', kbController.toggleBookmark);

module.exports = router;
