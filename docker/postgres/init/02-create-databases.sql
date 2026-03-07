-- Create additional databases if they don't exist.
-- POSTGRES_DB (gym_app) is created automatically by the image.
-- This script creates "axion" for projects that use it.
-- Safe to run: ignores "already exists" by checking first.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'axion') THEN
    CREATE DATABASE axion;
    RAISE NOTICE 'Database axion created.';
  END IF;
END
$$;
