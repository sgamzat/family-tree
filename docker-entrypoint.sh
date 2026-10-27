#!/bin/sh
# Порядок запуска — данные древа в приоритете:
# 1) без AUTH_SECRET не запускаемся;
# 2) копия базы перед любыми изменениями (если копия не удалась — сайт не стартует);
# 3) разделение: пользователи → /data/accounts, в базе древа только древо;
# 4) prisma db push — подгоняет базу под схему; изменения с потерей данных он не делает,
#    а останавливается с ошибкой (копия из шага 2 уже есть);
# 5) запуск сайта.
set -e

if [ -z "$AUTH_SECRET" ] || [ "${#AUTH_SECRET}" -lt 16 ]; then
  echo "AUTH_SECRET не задан или короче 16 символов. Добавьте его в .env — см. .env.example." >&2
  exit 1
fi

mkdir -p /data/tree /data/accounts /backups

if ! node scripts/backup.mjs --tag=pre-start --local; then
  echo "Резервная копия перед запуском не удалась — сайт не запускаю, данные не трогаю." >&2
  exit 1
fi

node scripts/split-accounts.mjs
npx prisma db push --skip-generate --schema=/app/prisma/schema.prisma
exec npx next start --hostname 0.0.0.0 --port 3000
