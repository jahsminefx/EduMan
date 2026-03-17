# EduMan — Offline-First School Management & Learning Platform

A comprehensive, offline-first school management system built with **React**, **Tailwind CSS**, **Node.js**, **Express**, and **SQLite**. EduMan supports 8 user roles with strict Role-Based Access Control (RBAC) and multi-tenant school isolation.

---

## ✨ Features

| Module | Description |
|--------|-------------|
| **Multi-Tenancy** | Complete school-level data isolation via `school_id` scoping |
| **RBAC (8 Roles)** | SuperAdmin, SchoolAdmin, Teacher, Student, Parent, ContentManager, Accountant, SupportOfficer |
| **Academic Management** | Classes, subjects, teacher-subject assignments, academic sessions & terms |
| **Attendance** | Daily attendance entry with teacher assignment validation |
| **Gradebook** | CA/Exam score entry scoped by teacher assignments |
| **Homework** | Teacher creates, students submit (with file attachments) |
| **Learning Library** | Upload/browse PDFs, videos, and documents (global + school-scoped) |
| **Quiz System** | MCQ quizzes with auto-grading and duplicate attempt prevention |
| **Report Cards** | Print-friendly student report cards with grade/remark tables |
| **JWT Authentication** | Stateless auth with school-scoped tokens |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ 
- **npm** v9+

### 1. Clone & Install

```bash
# Backend
cd EduMan/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Create `backend/.env`:
```env
JWT_SECRET=your_super_secret_key_here
PORT=5000
```

### 3. Start Development Servers

```bash
# Terminal 1 — Backend (Express + SQLite)
cd backend
node server.js

# Terminal 2 — Frontend (Vite + React)
cd frontend
npm run dev
```

- **Backend** → `http://localhost:5000`
- **Frontend** → `http://localhost:5173`

### 4. Seed the Database

```bash
cd backend
node seed.js
```

This creates 2 schools, 14 users across all 8 roles, classes, subjects, teacher assignments, students, parent links, attendance records, grades, and homework.

---

## 👤 Test Accounts

All accounts use password: **`password123`**

| Role | Email | School |
|------|-------|--------|
| SuperAdmin | `admin@eduman.local` | Global |
| SchoolAdmin | `adebayo@greenfield.edu.ng` | Greenfield Academy |
| SchoolAdmin | `okonkwo@sunrise.edu.ng` | Sunrise International |
| Teacher (Math) | `chidi@greenfield.edu.ng` | Greenfield Academy |
| Teacher (English) | `amina@greenfield.edu.ng` | Greenfield Academy |
| Student | `femi@student.greenfield.edu.ng` | Greenfield Academy |
| Student | `joy@student.greenfield.edu.ng` | Greenfield Academy |
| Parent | `chief.adesola@gmail.com` | Linked to Femi |
| ContentManager | `ibrahim@eduman.local` | Global |
| Accountant | `fashola@greenfield.edu.ng` | Greenfield Academy |
| SupportOfficer | `emeka@eduman.local` | Global |

---

## 📁 Project Structure

``` vbhgctjdng  5624ty
EduMan/
├── backend/
│   ├── server.js               # Entry point
│   ├── seed.js                 # Database seeding script
│   ├── .env                    # Environment variables
│   └── src/
│       ├── app.js              # Express app setup & route mounting
│       ├── config/database.js  # SQLite connection & schema init
│       ├── models/schema.sql   # Full database schema (16 tables)
│       ├── middleware/         # auth, RBAC, school-scope middlewares
│       ├── controllers/       # Route handlers (auth, school, class, etc.)
│       ├── routes/            # Express route definitions
│       └── utils/auth.js      # JWT helpers
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Router & route definitions
│   │   ├── contexts/          # AuthContext (JWT decode, login/logout)
│   │   ├── layouts/           # MainLayout with role-based sidebar
│   │   └── pages/
│   │       ├── Login.jsx      # Authentication page
│   │       ├── Dashboard.jsx  # Role-specific dashboards
│   │       ├── admin/         # ClassesList, StudentsList, TeachersList
│   │       ├── teacher/       # AttendanceEntry, GradesEntry, HomeworkPage
│   │       ├── content/       # ContentLibrary (learning materials)
│   │       ├── quiz/          # QuizPage (create/take quizzes)
│   │       └── reports/       # ReportCard (print-friendly)
│   └── tailwind.config.js
└── README.md
```

---

## 🔐 RBAC Architecture

### Permission Matrix

| Resource | SuperAdmin | SchoolAdmin | Teacher | Student | Parent | ContentManager |
|----------|:---------:|:-----------:|:-------:|:-------:|:------:|:--------------:|
| Schools | CRUD | Read Own | — | — | — | — |
| Classes | — | CRUD | Read | Read | — | — |
| Subjects | — | CRUD | Read | Read | — | — |
| Teachers | — | CRUD | Read Own | — | — | — |
| Students | — | CRUD | Read | Read Own | Read Child | — |
| Attendance | — | Read | Mark (assigned) | — | — | — |
| Grades | — | Read | Enter (assigned) | View Own | View Child | — |
| Homework | — | Delete | Create (assigned) | Submit | View | — |
| Quizzes | — | Delete | Create (assigned) | Take | — | — |
| Content | — | CRUD | Upload | View | View | CRUD (global) |
| Report Cards | — | View | View | View | View | — |

### Multi-Tenancy Enforcement

1. **JWT** includes `school_id` for scoped authorization
2. **`requireSchoolScope`** middleware blocks cross-school data access
3. **Teacher assignment validation** via `teacher_subject_assignments` table
4. **Parent-child links** via `parent_student_links` table

---

## 📦 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login & get JWT |
| GET | `/api/auth/me` | Protected | Current user info |
| GET/POST | `/api/schools` | SuperAdmin | Manage schools |
| GET/POST | `/api/classes/classes` | SchoolAdmin+ | Manage classes |
| GET/POST | `/api/classes/subjects` | SchoolAdmin+ | Manage subjects |
| GET/POST/DELETE | `/api/teachers` | SchoolAdmin | Manage teachers |
| GET/POST/PUT/DELETE | `/api/students` | SchoolAdmin | Manage students |
| GET/POST | `/api/attendance` | Teacher/SchoolAdmin | Attendance records |
| GET/POST | `/api/grades` | Teacher/SchoolAdmin | Grade entry |
| GET | `/api/grades/report/:studentId/:termId` | All | Student report |
| GET/POST/DELETE | `/api/homework` | Teacher/SchoolAdmin | Homework CRUD |
| POST | `/api/homework/submit` | Student | Submit homework |
| GET/POST/DELETE | `/api/content` | ContentManager/Teacher | Learning materials |
| GET/POST/DELETE | `/api/quizzes` | Teacher/SchoolAdmin | Quiz CRUD |
| POST | `/api/quizzes/submit` | Student | Submit quiz attempt |
| GET/POST | `/api/assignments` | SchoolAdmin | Teacher assignments |

---

## 🛠 Tech Stack

- **Frontend:** React 18, React Router, Axios, Lucide Icons, Tailwind CSS
- **Backend:** Node.js, Express, SQLite (via `sqlite3` + `sqlite`), JWT (`jsonwebtoken`), bcryptjs
- **Database:** SQLite (file-based, 16 tables)
- **Build:** Vite

---

## 📄 License

This project is for educational purposes.
