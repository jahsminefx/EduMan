const { getDB } = require('../config/database');

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

// ── GET ARTICLES (LIST WITH SEARCH & CATEGORY FILTER) ──
exports.getArticles = async (req, res) => {
    try {
        const { category = '', search = '', published = '' } = req.query;
        const userRole = req.user?.role;
        const db = getDB();

        let whereClauses = [];
        let params = [];
        let pIdx = 1;

        // Non-SuperAdmin users can only view published articles
        if (userRole !== 'SuperAdmin') {
            whereClauses.push(`published = 1`);
        } else if (published !== '') {
            whereClauses.push(`published = $${pIdx++}`);
            params.push(parseInt(published, 10));
        }

        if (category) {
            whereClauses.push(`category = $${pIdx++}`);
            params.push(category);
        }

        if (search.trim()) {
            const term = `%${search.trim()}%`;
            whereClauses.push(`(title ILIKE $${pIdx} OR content ILIKE $${pIdx} OR category ILIKE $${pIdx})`);
            params.push(term);
            pIdx++;
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const articles = await db.all(
            `SELECT a.*, u.name as author_name 
             FROM knowledge_base_articles a
             LEFT JOIN users u ON u.id = a.author_id
             ${whereSql}
             ORDER BY a.views DESC, a.created_at DESC`,
            params
        );

        return res.json(articles);
    } catch (err) {
        console.error('Error fetching knowledge base articles:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve articles' });
    }
};

// ── GET ARTICLE BY SLUG ──
exports.getArticleBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user.id;
        const db = getDB();

        const article = await db.get(
            `SELECT a.*, u.name as author_name 
             FROM knowledge_base_articles a
             LEFT JOIN users u ON u.id = a.author_id
             WHERE a.slug = $1 OR a.id::text = $1`,
            [slug]
        );

        if (!article) {
            return res.status(404).json({ error: 'Not Found', message: 'Article not found.' });
        }

        // Increment views counter
        await db.run(`UPDATE knowledge_base_articles SET views = views + 1 WHERE id = $1`, [article.id]);

        // Check if bookmarked by current user
        const bookmark = await db.get(`SELECT id FROM support_bookmarks WHERE user_id = $1 AND article_id = $2`, [userId, article.id]);

        return res.json({
            article: { ...article, views: article.views + 1 },
            isBookmarked: !!bookmark
        });
    } catch (err) {
        console.error('Error fetching article details:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve article details' });
    }
};

// ── CREATE ARTICLE (SUPER ADMIN) ──
exports.createArticle = async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only SuperAdmin can author Knowledge Base articles.' });
        }

        const { title, category, content, featured_image, published = 1 } = req.body;
        if (!title || !category || !content) {
            return res.status(400).json({ error: 'Bad Request', message: 'Title, category, and content are required.' });
        }

        const db = getDB();
        let slug = slugify(title);

        // Check unique slug
        const existing = await db.get(`SELECT id FROM knowledge_base_articles WHERE slug = $1`, [slug]);
        if (existing) {
            slug = `${slug}-${Date.now().toString().slice(-4)}`;
        }

        const newArticle = await db.get(
            `INSERT INTO knowledge_base_articles (title, slug, category, content, featured_image, published, author_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title.trim(), slug, category.trim(), content.trim(), featured_image || null, published ? 1 : 0, req.user.id]
        );

        return res.status(201).json(newArticle);
    } catch (err) {
        console.error('Error creating KB article:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to create Knowledge Base article' });
    }
};

// ── UPDATE ARTICLE (SUPER ADMIN) ──
exports.updateArticle = async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only SuperAdmin can edit Knowledge Base articles.' });
        }

        const { id } = req.params;
        const { title, category, content, featured_image, published } = req.body;
        const db = getDB();

        const article = await db.get(`SELECT * FROM knowledge_base_articles WHERE id = $1`, [id]);
        if (!article) {
            return res.status(404).json({ error: 'Not Found', message: 'Article not found.' });
        }

        let newSlug = article.slug;
        if (title && title !== article.title) {
            newSlug = slugify(title);
        }

        await db.run(
            `UPDATE knowledge_base_articles
             SET title = $1, slug = $2, category = $3, content = $4, featured_image = $5, published = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [
                title || article.title,
                newSlug,
                category || article.category,
                content || article.content,
                featured_image !== undefined ? featured_image : article.featured_image,
                published !== undefined ? (published ? 1 : 0) : article.published,
                article.id
            ]
        );

        const updated = await db.get(`SELECT * FROM knowledge_base_articles WHERE id = $1`, [article.id]);
        return res.json(updated);
    } catch (err) {
        console.error('Error updating KB article:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to update Knowledge Base article' });
    }
};

// ── DELETE ARTICLE (SUPER ADMIN) ──
exports.deleteArticle = async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only SuperAdmin can delete Knowledge Base articles.' });
        }

        const { id } = req.params;
        const db = getDB();

        await db.run(`DELETE FROM knowledge_base_articles WHERE id = $1`, [id]);
        return res.json({ message: 'Article deleted successfully.' });
    } catch (err) {
        console.error('Error deleting KB article:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to delete article' });
    }
};

// ── TOGGLE BOOKMARK ──
exports.toggleBookmark = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const db = getDB();

        const existing = await db.get(`SELECT id FROM support_bookmarks WHERE user_id = $1 AND article_id = $2`, [userId, id]);

        if (existing) {
            await db.run(`DELETE FROM support_bookmarks WHERE id = $1`, [existing.id]);
            return res.json({ isBookmarked: false, message: 'Bookmark removed.' });
        } else {
            await db.run(`INSERT INTO support_bookmarks (user_id, article_id) VALUES ($1, $2)`, [userId, id]);
            return res.json({ isBookmarked: true, message: 'Article bookmarked.' });
        }
    } catch (err) {
        console.error('Error toggling article bookmark:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to update bookmark' });
    }
};
