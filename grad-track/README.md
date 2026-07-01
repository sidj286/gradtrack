GRADTRACK - AI-ASSISTED ALUMNI CAREER TRACKING SYSTEM

A comprehensive alumni management and career tracking system for Cebu Roosevelt Memorial Colleges (CRMC).


OVERVIEW

GradTrack is a full-stack web application designed to help educational institutions track alumni employment outcomes, automate career data collection, and provide AI-powered career alignment insights. The system features separate dashboards for administrators and alumni, real-time updates, and exportable reports.

Live Demo: https://gradtrack.vercel.app


FEATURES

For Alumni:
- Secure registration with Student ID verification against official master list
- Profile management with profile picture upload
- Career information updates (job title, company, industry, location)
- AI-powered career alignment classification (In-Field / Out-of-Field)
- Confidence score display for career alignment
- View announcements with comment section
- Facebook-style threaded comments and replies
- Activity timeline (view your recent activities)
- Dark mode toggle
- PWA support (installable on mobile)

For Admin:
- Dashboard with real-time analytics and charts
- Department analytics (employment rates, alignment rates, batch analysis)
- Alumni directory with search and filters
- AI-powered program insights and recommendations
- Full announcement management (Create, Edit, Publish, Delete)
- Comment moderation (view, reply, delete)
- Master list import/export (CSV)
- Manual add graduates (emergency walk-in)
- Report generation (Excel for Alumni Master List, PDF for Employment Summary)
- Real-time notifications for alumni activities
- View individual alumni profile details

AI Integration:
- Google Gemini 2.0 Flash API for career classification
- In-Field / Out-of-Field classification with confidence scoring
- Program Insights with AI-generated recommendations
- Fallback mechanism (keyword matching when API rate limit reached)


TECHNOLOGY STACK

Frontend:
- React 18 with TypeScript
- Tailwind CSS for styling
- Vite as build tool
- Recharts for data visualization
- Lucide React for icons

Backend (BaaS):
- Supabase (PostgreSQL, Auth, Storage, Realtime)
- Google Gemini 2.0 Flash API for AI classification

Reporting:
- SheetJS (xlsx) for Excel exports
- jsPDF + autoTable for PDF exports

Deployment:
- Vercel (frontend)
- Supabase Cloud (backend)


GETTING STARTED

Prerequisites:
- Node.js 18+
- npm or yarn
- Supabase account (free tier)
- Google Gemini API key (free tier)

Installation:

1. Clone the repository
   git clone https://github.com/sidj286/gradtrack.git
   cd gradtrack/grad-track

2. Install dependencies
   npm install

3. Create .env file
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key

4. Start development server
   npm run dev

5. Build for production
   npm run build


DATABASE SCHEMA

Core Tables:
- users - User authentication and roles (Admin/Alumni)
- alumni_profiles - Main alumni data (employment, career alignment)
- graduates_master - Official graduate master list for verification
- announcements - Announcements with targeting (course/batch)
- announcement_comments - Threaded comments and replies
- announcement_views - Track viewed announcements
- alumni_activities - Audit trail and activity logs
- notifications - Real-time notifications for admin/alumni


KEY FEATURES EXPLAINED

AI Career Classification:
- Primary classifier uses Google Gemini 2.0 Flash API
- Semantic analysis of course vs job title
- Returns In-Field or Out-of-Field classification
- Confidence score calculation: 70% base + 5% per keyword match (capped at 98%)
- Fallback to keyword matching when API rate limit is exceeded

PSGC Address Selector:
- Cascading dropdown based on Philippine Standard Geographic Code (PSGC)
- Hierarchy: Region to Province to City/Municipality to Barangay to Street
- Official Philippine Statistics Authority (PSA) data

Real-time Updates:
- Supabase Realtime subscriptions
- Admin dashboard updates automatically when alumni update profiles

Announcement Comments:
- Threaded replies (Facebook-style)
- Alumni can comment and reply
- Admin can moderate (delete any comment)
- Real-time notifications for new comments


DEPLOYMENT

Vercel:
   npm run build
   Deploy the dist folder to Vercel

Environment Variables Required on Vercel:
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   VITE_GEMINI_API_KEY


LICENSE

Private - Cebu Roosevelt Memorial Colleges Capstone Project


TEAM

- Julbren Rusty Arcenal
- Melgie Bedrijo
- Cj Caayon
- Nicka Joy Gentapa


ACKNOWLEDGMENTS

First and foremost, we would like to thank Almighty God for His guidance, wisdom, and strength throughout the development of this project.

We also extend our deepest gratitude to the following individuals who made this project possible:

- Marjorie Reso, MIT - Adviser, for her invaluable guidance and support
- Leonard Balabat, MIT - Technical Expert, for his technical insights and feedback
- Dr. Shiela Tirol - Content Expert, for her expertise and recommendations
- Cebu Roosevelt Memorial Colleges - The institution that supported this capstone project
- Our families, friends, and everyone who prayed and believed in us

Thank you all for the unwavering support and encouragement.


SUPPORT

For questions or support, contact the development team or SASO office.

Built for CRMC Alumni