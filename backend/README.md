# BB Exchange API

Node.js API service for the BB Exchange website.

## Endpoints
- `/api/health` - service health check
- `/api/exchanges` - configured CEX list
- `/api/compare?asset=BTC&quote=USDT` - public order-book comparison

## Render deployment
- Repository: `brbr940916-stack/-bb-exchange`
- Branch: `main`
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

## Limitations
This starter sorts by top ask price only. Trading fees, slippage, fiat conversion, deposit/withdrawal costs, transfer time, regional restrictions, DEX pools, and country rankings are not yet included. Do not interpret unavailable markets as zero prices.
