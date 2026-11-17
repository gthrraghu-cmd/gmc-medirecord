# Gayathri MediRecord — Sprint Plan

Offline-first, PIN-locked patient record app for Gayathri Multi Speciality Clinic (Homoeopathy · Acupuncture · Cosmetology).
One codebase, installed as an app on Windows (Edge/Chrome) and on Android/iPhone. Records are stored only on the device (IndexedDB) and work with no internet.

| Sprint | Theme | Scope | Status |
|---|---|---|---|
| 1 | Foundation | Royal purple-and-gold UI from the crest, 4-digit PIN lock with idle auto-lock, dashboard (today, month revenue, follow-ups, department split), patient registry with auto GMC-0001 IDs, search and department filters, patient profile with allergy alert, consultation timeline, department-aware consultation form (Homoeopathy remedies with potency, Acupuncture points and sessions, Cosmetology procedures), follow-up recall (overdue / today / 7 days), backup and restore file, installable offline app | Delivered |
| 2 | Prescription & Billing | A5 printable prescription with crest letterhead, printable receipt, WhatsApp share of prescription text, pending-dues ledger, daily cash/UPI/card closing summary | Delivered |
| 3 | Appointments & Queue | Day/week calendar, token numbers, today's waiting queue with “called / done”, one-tap “book follow-up” from a consultation | Delivered |
| 4 | Clinical Depth | Homoeopathy case-taking template (mind, generals, particulars, miasm), remedy quick-pick list, acupuncture package tracker (sessions used / left), cosmetology before-and-after photos from camera stored on device | Delivered |
| 5 | Data Safety & Sync | Password-encrypted backups (AES-GCM), weekly backup reminder, export to Excel, laptop ↔ phone transfer via encrypted backup file and the share sheet | Delivered |
| 6 | Insights & Polish | Revenue and patient-growth charts, department analytics, Tamil / English toggle, light theme option, keyboard shortcuts for desktop | Delivered |
| 7 | Full Tamil & Print Pack | Every screen, form, dialog and message in Tamil (data values stay unchanged), printable A4 homoeopathic case sheet with consultation summary, printable A4 monthly report (KPIs, departments, payment modes, top diagnoses and remedies, daily collections) | Delivered |
| 8 | Clinic Essentials | Automatic daily encrypted backup to a chosen folder on the Windows laptop (keeps the last 14, works with OneDrive/Google Drive folders), per-patient Documents tab for PDF lab reports and camera scans, one-tap WhatsApp follow-up reminders and quick booking from Follow-ups | Delivered |
| 9 | Doctor Speed & Clinic Money | Prescription templates (save from any consultation, apply in one tap, manage in Settings), expense tracking with categories, cash-in-hand on the daily closing, expenses and net profit in Reports with a revenue-vs-expenses chart, expenses on the monthly report and a new Excel sheet | Delivered |

## Definition of done (every sprint)
- `npm run build` passes
- Works with Wi-Fi turned off after first install
- Checked on a 1440px desktop and a 390px phone screen
- Backup from the previous sprint restores cleanly


## Sprint 10 — Encrypted multi-device sync · Delivered
- Clinic's own Supabase project; one sync account; records sealed with AES-256-GCM on the device using a clinic passphrase before upload
- Offline-first: every device works without internet and swaps only changed records when online (every 30 s, on reconnect, and a few seconds after each change)
- Newest edit wins; deletions reach every device; new records get clash-proof IDs; patient codes and receipt numbers continue from the highest seen
- Settings → Sync across devices: set up the first device, join with a join code, sync now, turn off; live status in the sidebar and mobile header

## Sprint 11 — Windows desktop app · Delivered
- Installer (Gayathri-MediRecord-Setup.exe) with Desktop and Start-menu shortcuts, own window, fully offline

## Sprint 12 — PostgreSQL storage · Delivered
- Desktop app saves every record into the laptop's PostgreSQL (schema `medirecord`); database and tables created automatically
- Ready-made views: patient_list, consultation_list, expense_list; photos and documents stored as bytea in `medirecord.files`
- Works on if PostgreSQL is stopped and saves waiting changes when it is back; reinstalling pulls everything back from PostgreSQL
