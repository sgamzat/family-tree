#!/bin/sh
set -e

mkdir -p /data
npx prisma db push --skip-generate --schema=/app/prisma/schema.prisma
exec npx next start --hostname 0.0.0.0 --port 3000
