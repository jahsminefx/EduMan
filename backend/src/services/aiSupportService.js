/**
 * AI Support Service - Architecture Readiness Layer
 * Formatted and prepared for future AI model integration (e.g. OpenAI / Gemini / EduMan AI).
 */

const { getDB } = require('../config/database');

/**
 * Predicts / suggests a reply based on ticket subject and message history
 */
async function generateSuggestedReply(threadId) {
    try {
        const db = getDB();
        const thread = await db.get(`SELECT * FROM support_threads WHERE id = $1`, [threadId]);
        if (!thread) return null;

        const messages = await db.all(
            `SELECT m.*, u.name as sender_name FROM support_messages m JOIN users u ON u.id = m.sender_id WHERE m.thread_id = $1 ORDER BY m.created_at ASC`,
            [threadId]
        );

        // Future extension: Call LLM API (e.g. Gemini / OpenAI) to generate intelligent response suggestion based on Knowledge Base
        const sampleSuggestion = `Hello! Thank you for reaching out regarding "${thread.subject}". Our team has reviewed your request under ${thread.category}. Please verify if your account permissions and school settings are up to date, or let us know if you need step-by-step assistance.`;
        
        return {
            suggestedReply: sampleSuggestion,
            confidenceScore: 0.92,
            matchedKnowledgeBaseArticles: [
                { id: 1, title: 'Getting Started with EDUMAN', slug: 'getting-started' }
            ]
        };
    } catch (err) {
        console.error('Error generating AI suggested reply:', err);
        return null;
    }
}

/**
 * Predicts category & category confidence score for a ticket
 */
async function categorizeAndScoreTicket(subject, message) {
    const text = `${subject} ${message}`.toLowerCase();
    let category = 'General Question';
    let confidence = 0.85;

    if (text.includes('bug') || text.includes('error') || text.includes('failed') || text.includes('crash')) {
        category = 'Bug Report';
        confidence = 0.95;
    } else if (text.includes('student')) {
        category = 'Student Management';
    } else if (text.includes('teacher')) {
        category = 'Teacher Management';
    } else if (text.includes('attendance')) {
        category = 'Attendance';
    } else if (text.includes('grade') || text.includes('result')) {
        category = 'Results';
    } else if (text.includes('timetable') || text.includes('schedule')) {
        category = 'Timetable';
    } else if (text.includes('ai') || text.includes('assistant')) {
        category = 'AI Assistant';
    } else if (text.includes('billing') || text.includes('payment') || text.includes('invoice')) {
        category = 'Billing';
    }

    return { category, confidenceScore: confidence };
}

/**
 * Detects urgency / priority based on text sentiment and key phrases
 */
async function detectPriority(subject, message) {
    const text = `${subject} ${message}`.toLowerCase();
    if (text.includes('urgent') || text.includes('critical') || text.includes('system down') || text.includes('cannot log in')) {
        return { priority: 'CRITICAL', priorityScore: 0.98, sentiment: 'Negative/Urgent' };
    } else if (text.includes('important') || text.includes('high priority') || text.includes('broken')) {
        return { priority: 'HIGH', priorityScore: 0.85, sentiment: 'Negative' };
    }
    return { priority: 'MEDIUM', priorityScore: 0.50, sentiment: 'Neutral' };
}

/**
 * Detects duplicate open/recent tickets within the same school
 */
async function findDuplicateTickets(subject, message, schoolId) {
    try {
        const db = getDB();
        if (!schoolId) return [];
        const recentThreads = await db.all(
            `SELECT id, ticket_number, subject, status, created_at FROM support_threads WHERE school_id = $1 AND status != 'CLOSED' ORDER BY created_at DESC LIMIT 10`,
            [schoolId]
        );
        
        // Simple string matching fallback
        const duplicates = recentThreads.filter(t => 
            t.subject.toLowerCase().includes(subject.toLowerCase()) || subject.toLowerCase().includes(t.subject.toLowerCase())
        );

        return duplicates;
    } catch (err) {
        console.error('Error searching duplicate tickets:', err);
        return [];
    }
}

module.exports = {
    generateSuggestedReply,
    categorizeAndScoreTicket,
    detectPriority,
    findDuplicateTickets
};
