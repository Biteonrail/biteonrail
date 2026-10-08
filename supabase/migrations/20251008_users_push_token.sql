-- Expo push token for the BiteOnRail mobile app, saved per phone number so the admin backend
-- can push order-status updates to that passenger's device. NULL for users who have never
-- opened the app (web-only passengers) or haven't granted notification permission.
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL;
