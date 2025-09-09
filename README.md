# Lab Inventory App

A lightweight React + Vite application to manage and visualize laboratory reagents.  
Features include:
- Add, edit, and delete reagents with quantity, container type, and notes
- Minimum stock thresholds highlighted
- Quick increment/decrement buttons for real-time adjustments
- Sync with Google Sheets (via Apps Script web app) for persistence and collaboration
- Dashboard cards and bar chart visualization (by item or container)

---

## Tech Stack
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) (fast dev/build toolchain)
- [Recharts](https://recharts.org/) (bar chart visualization)
- [Framer Motion](https://www.framer.com/motion/) (animations)
- [Tailwind CSS](https://tailwindcss.com/) (utility-first styling)
- GitHub Pages for static hosting
- GitHub Actions for CI/CD deployment

---

## Deployment

### Development

Start the local dev server:
```bash
npm install
npm run dev
```
The app runs at http://localhost:5173 by default.

###  Production Build

Create an optimized build that outputs to the dist/ directory
```
npm run build
```  

To preview the production build locally:
```
npm run preview
```
### Deployment on GitHub Pages

We use project pages hosted under:

`https://<username>.github.io/lab-inventory-app/`

### Base Path

Because this is a project site (not a user site), we set Vite’s base path in vite.config.js:

```js
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/lab-inventory-app/' : '/',
  // ...
}))
```
---

## Automatic Deployment (GitHub Actions)

Instead of manually copying the build into docs/, we use a GitHub Actions workflow:
* File: .github/workflows/pages-docs.yml
* Trigger: runs automatically on every push to main
* Steps:
    1. Install dependencies
    2. Run npm run build
    3. Copy dist/ → docs/
    4. Add a fallback 404.html for SPA routing
    5. Commit and push changes to docs/

GitHub Pages is configured (Settings → Pages) to serve from the /docs folder on main.

This means any code pushed to main → CI builds → site auto-updates 🎉

---

## Sync with Google Sheets

The app includes optional sync with a Google Apps Script backend.
* BASE_URL points to a deployed Apps Script Web App (/exec URL).
* Data is pulled on load (action=items) and updated via upsert/delete actions.
* We use Content-Type: text/plain in POSTs to avoid CORS preflight issues.

Code in the [code.gs](code.gs) file to be copy/pasted into Extension -> Apps Script of your google sheet.

## Notes

If you want a custom domain, configure it in GitHub Pages settings (CNAME).

For SPA routes to work on Pages, we duplicate index.html → 404.html.

Make sure your Apps Script is deployed with “Anyone with link” and “Execute as Me”.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](license.txt) file for details.
