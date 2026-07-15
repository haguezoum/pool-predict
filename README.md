# Pool Predict

Campus pool match predictions for **42 Network**. Sign in with Intra, pick winners, climb the leaderboard.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui
- React Router

## Scripts

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Pages

| Route | Description |
|-------|-------------|
| `/login` | 42 Network sign-in only |
| `/` | Main matches board (protected) |
| `/leaderboard` | Season rankings (protected) |
| `/profile` | User stats & logout (protected) |

Auth is currently a **local mock** (`localStorage`). Wire `loginWith42` in `src/context/auth-context.tsx` to real Intra OAuth when ready.
