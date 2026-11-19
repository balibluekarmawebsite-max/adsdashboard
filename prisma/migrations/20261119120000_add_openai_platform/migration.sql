-- Add OpenAI (ChatGPT Ads) as a third ad platform.
-- Non-destructive: appends a value to the existing "Platform" enum. No rows are
-- rewritten, and the new value is not used anywhere until OpenAI data is synced,
-- so this is safe to apply on the live database.
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'openai';
