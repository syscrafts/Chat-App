#!/bin/sh

echo "Waiting for PostgreSQL to be ready..."

# Wait until postgres is accepting connections
until node -e "
const { Client } = require('pg');
const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
client.connect().then(() => { client.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "Postgres not ready yet, retrying in 2s..."
  sleep 2
done

echo "PostgreSQL is ready. Running migrations..."
npm run migrate

echo "Starting backend server..."
exec npm run dev
