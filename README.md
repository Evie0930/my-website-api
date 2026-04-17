# my-website-api

Backend API for my personal portfolio site.  
Deployed as [Vercel Serverless Functions](https://vercel.com/docs/functions).

## Routes

| Method | Path            | Description        |
|--------|-----------------|--------------------|
| GET    | /api/barrages   | Fetch barrages     |
| POST   | /api/barrages   | Submit a barrage   |
| GET    | /api/message    | Alias ¡ú /api/barrages |
| POST   | /api/message    | Alias ¡ú /api/barrages |
| GET    | /api/views      | Increment & get site views |
| GET    | /api/projects   | Fetch projects list |

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase credentials.
2. Run `npm install`.
3. Run `vercel dev` for local development.

## Deploy

Connect this repo to Vercel. Set the following environment variables in the Vercel dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`