

# 🚢 Grand Rose Cruise - SaaS Guest Feedback Platform

## Overview
A multi-tenant SaaS platform for cruise ships to collect, analyze, and report guest feedback digitally. Each cruise ship gets its own workspace with QR-based guest forms, AI-powered analytics, and PDF reporting.

---

## 🔐 User Roles & Hierarchy

### 1. System Owner (You)
- Create/manage multiple cruise ship accounts (tenants)
- View all ships' data and analytics
- Manage subscription/billing per ship
- Global dashboard with cross-ship insights

### 2. Ship Owner (User Owner - per cruise)
- Manage their ship's settings (name, logo, rooms)
- Add/remove admin users (Reception, Manager)
- View AI analytics dashboard
- Download/delete feedback PDFs
- Generate QR codes for their ship

### 3. Manager Admin
- View dashboard with all feedback
- Download PDF reports & AI analysis
- Cannot manage users or ship settings

### 4. Reception Admin
- View incoming feedback in real-time
- Basic dashboard access
- Cannot download or delete data

### 5. Guest (No login required)
- Scans QR code → selects language → enters room → fills form
- No account needed

---

## 📝 Guest Feedback Form (from your image)

### Section 1: Services
Rating scale: Excellent / Very Good / Good / Fair
- Reception
- Laundry
- Housekeeping
- Cabins
- Cleanliness
- Maintenance
- Free-text comments field

### Section 2: Facilities
Rating scale: Excellent / Very Good / Good / Fair
- Restaurant
- Lounge Bar
- Sundeck Bar / Bar del solárium
- Swimming Pool
- Free-text comments field

### Section 3: Food
Rating scale: Excellent / Very Good / Good / Fair
- Quality
- Quantity
- Variety
- Free-text comments field

### Section 4: General
- Comments and suggestions for improvement (free text)
- Room number (entered at start)

---

## 🌍 Multi-Language Support
- Guest sees the form in their selected language (Korean, Japanese, Hindi, Chinese, Spanish, Italian, English, Dutch, French, Polish, German, and more)
- All admin/owner dashboards always display in English
- Translations stored in the app, not dependent on external services
- Comments from guests are stored as-is in their language, AI translates them in analysis

---

## 📱 Guest Flow (QR Code)
1. Guest scans QR code (unique per ship)
2. Language selection screen (flags + language names)
3. Enter room number
4. Beautiful, easy-to-fill form with tap-to-rate
5. Submit → form is captured as JPG image → stored in PDF
6. Thank you screen with ship branding

---

## 🤖 AI-Powered Analytics (Lovable AI)
- Analyzes all submitted forms for a ship
- Generates:
  - **Average ratings** per section and per item
  - **Recurring problems** detection
  - **Improvement suggestions** prioritized by impact
  - **Sentiment analysis** on free-text comments
  - **Trend analysis** over time
- Output as a downloadable **PDF presentation** with charts and insights
- All analysis displayed in English for admins

---

## 📊 Admin Dashboard
- **Real-time feed** of incoming guest feedback
- **Statistics cards**: total responses, average ratings, top issues
- **Charts**: ratings by department, trends over time, language distribution
- **PDF Management**: view all form PDFs, bulk download, bulk delete
- **AI Report**: generate on-demand AI analysis as PDF presentation

---

## 🏗 Technical Architecture

### Frontend (React + TypeScript + Tailwind)
- Multi-tenant routing (`/ship/:shipId/feedback` for guests)
- Responsive design optimized for mobile (QR scan)
- Clean, modern UI with ship branding support

### Backend (Lovable Cloud / Supabase)
- **Database**: Ships, Users, Roles, Feedback, PDF storage
- **Auth**: Email-based login for admins/owners, no auth for guests
- **Storage**: Supabase Storage for PDF/JPG files
- **Edge Functions**: AI analysis, PDF generation, form-to-image conversion
- **RLS**: Tenant isolation - each ship only sees their data

### AI Integration (Lovable AI Gateway)
- Edge function for analyzing feedback batches
- Structured output for ratings aggregation
- Natural language analysis for comments

---

## 🎨 Design Philosophy
- Clean, minimal guest form - easy for any nationality to understand
- Visual rating system (stars or colored buttons, not checkboxes)
- Ship-branded thank you page
- Professional admin dashboard with dark/light mode
- Mobile-first for guest form, desktop-optimized for admin

---

## 📦 Key Features Summary
1. **Multi-tenant SaaS** - one platform, many cruise ships
2. **QR-to-Form** - seamless guest experience, no login
3. **30+ languages** - auto-translated form UI
4. **Form-to-PDF** - each submission saved as image in PDF
5. **AI Analytics** - smart insights, not just numbers
6. **Role-based access** - 4 levels of permissions
7. **Bulk operations** - download all, delete all to save storage
8. **Beautiful UI** - modern, easy, impressive

