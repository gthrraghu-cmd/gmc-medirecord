# Gayathri MediRecord

Private, offline patient record app for Gayathri Multi Speciality Clinic.

- React 18 · Vite · Tailwind · Framer Motion · Dexie (IndexedDB) · PWA
- Runs fully offline after the first open; records never leave the device
- Installs as its own app window on Windows and on the phone home screen

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Publish once, install everywhere

1. Push this repo to GitHub.
2. Repo → Settings → Pages → Source: **GitHub Actions**. The included workflow builds and publishes on every push to `main`.
3. Open the Pages link once on each device and install:
   - **Windows (Edge/Chrome):** install icon in the address bar → Install
   - **Android (Chrome):** ⋮ → Add to Home screen → Install
   - **iPhone (Safari):** Share → Add to Home Screen
4. From then on, open it from the Start menu / home screen — no internet needed.

Only the app code is published. Patient data lives in each device's local storage and is never uploaded.

## Moving records between laptop and phone

Settings → Download backup on one device → send the `.json` file to the other device → Settings → Restore from file.

## Sprint plan

See `SPRINT_PLAN.md`.
