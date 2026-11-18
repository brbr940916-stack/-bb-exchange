# BB Exchange API (starter)

This is a separate Node.js API service for the existing BB Exchange static website.

## What it does
- `/api/health` - health check
- `/api/exchanges` - configured CEX list
- `/api/compare?asset=BTC&quote=USDT` - fetches public order books from supported exchanges and sorts available markets by best ask

## Important limitations
- Public market data only. No API keys or trading permissions are used.
- Results are sorted by the top ask price only.
- Trading fees, slippage for a target order size, fiat conversion, deposit/withdrawal fees, transfer time and regional access restrictions are not yet included.
- A market can be unavailable on an exchange because the pair is not listed, the exchange blocks the server region, or its API is temporarily unavailable.
- DEX integration and country rankings are separate future tasks. Do not treat DEX pools as centralized order books.

## Deploy on Render
Create a **new Web Service** (keep the existing Static Site for the website).
- Repository: `brbr940916-stack/-bb-exchange`
- Branch: `main`
- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Instance: Free for initial testing

The `backend` folder must be uploaded to the root of the GitHub repository so that `backend/package.json` and `backend/server.js` exist.

After deployment, test:
`https://YOUR-BACKEND.onrender.com/api/health`
`https://YOUR-BACKEND.onrender.com/api/compare?asset=BTC&quote=USDT`

## Frontend connection
Once the Web Service URL is known, the website's `app.js` can call:
`https://YOUR-BACKEND.onrender.com/api/compare?asset=BTC&quote=USDT`

Keep the backend URL in one configuration constant in the frontend. Do not expose private API keys in browser code.
