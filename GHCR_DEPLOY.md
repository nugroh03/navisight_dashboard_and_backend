# Pull and Deploy from GHCR

## For Dokploy

Set this as your image source in Dokploy:

```
ghcr.io/OWNER/REPO:latest
```

Replace:
- `OWNER` with your GitHub username/organization
- `REPO` with your repository name

Example:
```
ghcr.io/johndoe/navisight:latest
```

## Environment Variables Required

Set these in Dokploy dashboard:

```bash
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_random_secret_here
NEXT_PUBLIC_APP_NAME=NAVISIGHT
```

## Post-Deploy

After first deployment, run migrations:

```bash
npx prisma migrate deploy
npx prisma db seed
```

## Update Application

The image auto-updates when you push to GitHub main branch.
In Dokploy, just redeploy to pull the latest image.
