# ClearSAR Frontend

ClearSAR is a React + TypeScript frontend for browsing the SAR-to-optical workflow and evaluation views.

## Tech Stack

- React 18
- TypeScript
- Vite

## Frontend App

The application lives in `clearsar-app/` and includes the following main views:

- Landing
- Upload
- Processing
- Results
- Library (dashboard)
- Evaluation (admin)

Navigation is component-driven from `src/App.tsx` and supports keyboard shortcuts for quick page switching.

## Run Locally

```bash
cd clearsar-app
npm install
npm run dev
```

## Build

```bash
cd clearsar-app
npm run build
npm run preview
```

## Repository Notes

- The old prototype bundle folder `project/` has been removed from this repository.
# Updated on Fri May 15 23:34:34 PKT 2026
