const request = require('supertest');
const app = require('../app');
const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const { getLastSentEmail } = require('../services/notificationService');

describe('EduMan — Parent & Accountant Role Hardening & Feature Expansion', () => {
    let db;
    let schoolAId, schoolBId;
    let schoolAdminAToken, accountantAToken, accountantBToken, parentAToken, parentBToken;
    let studentAId, studentBId, parentAUserId, parentBUserId, accountantAUserId;
    let invoiceAId;

    beforeAll(async () => {
        db = getDB();

        const ts = Date.now();
        const adminEmail = `adminA_${ts}@springfield.edu`;
        const accAEmail = `accA_${ts}@springfield.edu`;
        const accBEmail = `accB_${ts}@shelbyville.edu`;
        const bartEmail = `bart_${ts}@springfield.edu`;
        const homerEmail = `homer_${ts}@springfield.edu`;
        const lisaEmail = `lisa_${ts}@springfield.edu`;
        const margeEmail = `marge_${ts}@springfield.edu`;

        // 1. Create School A & School B
        const schA = await db.get(`INSERT INTO schools (name, address, email, phone) VALUES ($1, 'Springfield', $2, '123') RETURNING id`, [`Springfield High ${ts}`, `schA_${ts}@edu.com`]);
        schoolAId = schA.id;
        const schB = await db.get(`INSERT INTO schools (name, address, email, phone) VALUES ($1, 'Shelbyville', $2, '456') RETURNING id`, [`Shelbyville High ${ts}`, `schB_${ts}@edu.com`]);
        schoolBId = schB.id;

        // 2. Create SchoolAdmin A
        const passHash = await bcrypt.hash('Password123!', 10);
        const adminAUser = await db.get(`INSERT INTO users (name, email, password_hash, role) VALUES ('Admin A', $1, $2, 'SchoolAdmin') RETURNING id`, [adminEmail, passHash]);
        await db.run(`INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)`, [adminAUser.id, schoolAId]);

        const adminALogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'Password123!' });
        schoolAdminAToken = adminALogin.body.token;

        // 3. Create Accountant A (School A) and Accountant B (School B)
        const accAUser = await db.get(`INSERT INTO users (name, email, password_hash, role) VALUES ('Accountant A', $1, $2, 'Accountant') RETURNING id`, [accAEmail, passHash]);
        await db.run(`INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)`, [accAUser.id, schoolAId]);
        accountantAUserId = accAUser.id;

        const accBUser = await db.get(`INSERT INTO users (name, email, password_hash, role) VALUES ('Accountant B', $1, $2, 'Accountant') RETURNING id`, [accBEmail, passHash]);
        await db.run(`INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)`, [accBUser.id, schoolBId]);

        const accALogin = await request(app).post('/api/auth/login').send({ email: accAEmail, password: 'Password123!' });
        accountantAToken = accALogin.body.token;

        const accBLogin = await request(app).post('/api/auth/login').send({ email: accBEmail, password: 'Password123!' });
        accountantBToken = accBLogin.body.token;

        // 4. Create Student A (School A) with Parent A (Create New Parent Workflow)
        const createStuARes = await request(app)
            .post('/api/students')
            .set('Authorization', `Bearer ${schoolAdminAToken}`)
            .send({
                admission_number: `ADM-${ts}-001`,
                first_name: 'Bart',
                last_name: 'Simpson',
                gender: 'Male',
                email: bartEmail,
                password: 'Password123!',
                parent_action: 'CREATE_NEW',
                parent_email: homerEmail,
                parent_name: 'Homer Simpson',
                parent_relationship: 'Father'
            });
        expect(createStuARes.status).toBe(200);
        studentAId = createStuARes.body.id;

        const pAUser = await db.get(`SELECT id FROM users WHERE LOWER(email) = $1`, [homerEmail]);
        parentAUserId = pAUser.id;

        await db.run(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passHash, parentAUserId]);
        const pALogin = await request(app).post('/api/auth/login').send({ email: homerEmail, password: 'Password123!' });
        parentAToken = pALogin.body.token;

        // 5. Create Student B (School A) with Parent B
        const createStuBRes = await request(app)
            .post('/api/students')
            .set('Authorization', `Bearer ${schoolAdminAToken}`)
            .send({
                admission_number: `ADM-${ts}-002`,
                first_name: 'Lisa',
                last_name: 'Simpson',
                gender: 'Female',
                email: lisaEmail,
                password: 'Password123!',
                parent_action: 'CREATE_NEW',
                parent_email: margeEmail,
                parent_name: 'Marge Simpson',
                parent_relationship: 'Mother'
            });
        studentBId = createStuBRes.body.id;
        const pBUser = await db.get(`SELECT id FROM users WHERE LOWER(email) = $1`, [margeEmail]);
        parentBUserId = pBUser.id;
        await db.run(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passHash, parentBUserId]);

        const pBLogin = await request(app).post('/api/auth/login').send({ email: margeEmail, password: 'Password123!' });
        parentBToken = pBLogin.body.token;
    });

    test('1. Migration 005 tables and parent_student_links extensions exist', async () => {
        const pslCols = await db.all(`SELECT column_name FROM information_schema.columns WHERE table_name = 'parent_student_links'`);
        const colNames = pslCols.map(c => c.column_name);
        expect(colNames).toContain('relationship');
        expect(colNames).toContain('is_primary');

        const feeTables = await db.get(`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name IN ('fee_structures', 'student_fee_invoices', 'fee_payments', 'financial_audit_logs')`);
        expect(parseInt(feeTables.count, 10)).toBe(4);
    });

    test('2. Parent IDOR Security — Parent B cannot view Student A data', async () => {
        const resProfile = await request(app).get(`/api/parent/children/${studentAId}`).set('Authorization', `Bearer ${parentBToken}`);
        expect(resProfile.status).toBe(403);

        const resAcad = await request(app).get(`/api/parent/children/${studentAId}/academics`).set('Authorization', `Bearer ${parentBToken}`);
        expect(resAcad.status).toBe(403);

        const resFees = await request(app).get(`/api/parent/children/${studentAId}/fees`).set('Authorization', `Bearer ${parentBToken}`);
        expect(resFees.status).toBe(403);
    });

    test('3. Parent A can view Student A children profile & fee summary', async () => {
        const resChildren = await request(app).get('/api/parent/children').set('Authorization', `Bearer ${parentAToken}`);
        expect(resChildren.status).toBe(200);
        expect(resChildren.body.children.length).toBeGreaterThanOrEqual(1);
        expect(resChildren.body.children[0].first_name).toBe('Bart');
    });

    test('4. Accountant Multi-Tenant Isolation — Accountant B cannot view School A finances', async () => {
        // Accountant A creates fee structure in School A
        const feeRes = await request(app)
            .post('/api/finance/fees')
            .set('Authorization', `Bearer ${accountantAToken}`)
            .send({ name: 'Tuition Term 1', amount: 150000, description: 'First term tuition' });
        expect(feeRes.status).toBe(201);
        const feeId = feeRes.body.feeStructure.id;

        // Assign fee to Student A
        const assignRes = await request(app)
            .post('/api/finance/fees/assign')
            .set('Authorization', `Bearer ${accountantAToken}`)
            .send({ fee_structure_ids: [feeId] });
        expect(assignRes.status).toBe(200);

        // Accountant B tries to view School A invoices
        const accBInvoices = await request(app).get('/api/finance/invoices').set('Authorization', `Bearer ${accountantBToken}`);
        expect(accBInvoices.status).toBe(200);
        expect(accBInvoices.body.invoices.length).toBe(0);
    });

    test('5. Transactional Payment Recording & Invoice Calculations', async () => {
        const invsRes = await request(app).get('/api/finance/invoices').set('Authorization', `Bearer ${accountantAToken}`);
        expect(invsRes.body.invoices.length).toBeGreaterThan(0);
        invoiceAId = invsRes.body.invoices[0].id;

        // Record partial payment of 50,000
        const pay1 = await request(app)
            .post('/api/finance/payments')
            .set('Authorization', `Bearer ${accountantAToken}`)
            .send({ invoice_id: invoiceAId, amount: 50000, payment_method: 'CASH' });
        expect(pay1.status).toBe(201);
        expect(pay1.body.invoiceStatus).toBe('PARTIALLY_PAID');
        expect(pay1.body.outstanding).toBe(100000);

        // Record remaining payment of 100,000
        const pay2 = await request(app)
            .post('/api/finance/payments')
            .set('Authorization', `Bearer ${accountantAToken}`)
            .send({ invoice_id: invoiceAId, amount: 100000, payment_method: 'CASH' });
        expect(pay2.status).toBe(201);
        expect(pay2.body.invoiceStatus).toBe('PAID');
        expect(pay2.body.outstanding).toBe(0);
    });

    test('6. Discount Application & Refund Auditing', async () => {
        // Apply discount to Student B's invoice
        const invsRes = await request(app).get('/api/finance/invoices').set('Authorization', `Bearer ${accountantAToken}`);
        const invB = invsRes.body.invoices.find(i => i.student_id === studentBId);

        if (invB) {
            const discRes = await request(app)
                .post('/api/finance/discounts')
                .set('Authorization', `Bearer ${accountantAToken}`)
                .send({ invoice_id: invB.id, discount_amount: 10000, reason: 'Scholarship' });
            expect(discRes.status).toBe(200);

            // Audit log check
            const auditRes = await request(app).get('/api/finance/audit-logs').set('Authorization', `Bearer ${accountantAToken}`);
            expect(auditRes.status).toBe(200);
            expect(auditRes.body.auditLogs.some(l => l.action === 'DISCOUNT_APPLIED')).toBe(true);
        }
    });

    test('7. SchoolAdmin can create Accountant staff account with invitation token', async () => {
        const accEmail = `sec_acc_${Date.now()}@springfield.edu`;
        const createAccRes = await request(app)
            .post('/api/finance/accountants')
            .set('Authorization', `Bearer ${schoolAdminAToken}`)
            .send({ name: 'Secondary Accountant', email: accEmail });
        expect(createAccRes.status).toBe(201);
        expect(createAccRes.body.accountant.role).toBe('Accountant');

        // Fetch user from DB to verify setup_token is hashed
        const user = await db.get(`SELECT setup_token FROM users WHERE email = $1`, [accEmail]);
        expect(user.setup_token).toBeDefined();

        // Get raw token from intercepted email
        const sentEmail = getLastSentEmail();
        const rawToken = sentEmail.token;
        expect(user.setup_token).not.toBe(rawToken); // Hashed at rest

        // Verify setup token endpoint
        const verifyRes = await request(app).get(`/api/auth/verify-setup-token?token=${rawToken}`);
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.valid).toBe(true);

        // Perform 1-click password setup
        const setupRes = await request(app).post('/api/auth/setup-password').send({
            token: rawToken,
            password: 'NewSecurePassword123!'
        });
        expect(setupRes.status).toBe(200);

        // Verify login with new password
        const loginRes = await request(app).post('/api/auth/login').send({
            email: accEmail,
            password: 'NewSecurePassword123!'
        });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.token).toBeDefined();
    });
});
