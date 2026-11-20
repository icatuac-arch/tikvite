-- ============================================================
-- Tikvite — Partiful-inspired Features Schema
-- ============================================================

-- 1. EVENT COMMENTS / DISCUSSION
CREATE TABLE IF NOT EXISTS event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES event_comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL DEFAULT '',
  author_avatar_url TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_organizer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_comments_event ON event_comments (event_id, created_at DESC);
CREATE INDEX idx_event_comments_parent ON event_comments (parent_id);

-- Comment likes (prevent double-liking)
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES event_comments(id) ON DELETE CASCADE,
  liker_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, liker_email)
);

-- 2. EVENT PHOTO GALLERY
CREATE TABLE IF NOT EXISTS event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploader_name TEXT NOT NULL,
  uploader_email TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  likes_count INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_photos_event ON event_photos (event_id, created_at DESC);

-- 3. "WHO'S GOING" — Enhanced RSVP visibility
-- (Uses existing event_rsvps table, we add a column for public display opt-in)
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS show_publicly BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS social_handle TEXT NOT NULL DEFAULT '';

-- Social signals: interested / going / maybe
CREATE TABLE IF NOT EXISTS event_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  signal TEXT NOT NULL CHECK (signal IN ('interested', 'going', 'maybe')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_email)
);

CREATE INDEX idx_event_interest_event ON event_interest (event_id, signal);

-- 4. CUSTOM RSVP QUESTIONS
CREATE TABLE IF NOT EXISTS event_rsvp_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text' CHECK (question_type IN ('text', 'textarea', 'select', 'multiselect', 'checkbox', 'number')),
  options JSONB, -- for select/multiselect: ["Option A", "Option B"]
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rsvp_questions_event ON event_rsvp_questions (event_id, sort_order);

-- Answers stored per RSVP
CREATE TABLE IF NOT EXISTS event_rsvp_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL REFERENCES event_rsvps(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES event_rsvp_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL DEFAULT '',
  answer_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rsvp_id, question_id)
);

-- 5. ORGANIZER PUBLIC PROFILES
CREATE TABLE IF NOT EXISTS organizer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  twitter TEXT NOT NULL DEFAULT '',
  followers_count INTEGER NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizer_profiles_slug ON organizer_profiles (slug);
CREATE INDEX idx_organizer_profiles_user ON organizer_profiles (user_id);

-- Follower relationship
CREATE TABLE IF NOT EXISTS organizer_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizer_profiles(id) ON DELETE CASCADE,
  follower_email TEXT NOT NULL,
  follower_name TEXT NOT NULL DEFAULT '',
  notify_new_events BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organizer_id, follower_email)
);

CREATE INDEX idx_organizer_followers_org ON organizer_followers (organizer_id);

-- 6. TEXT BLASTS (SMS)
CREATE TABLE IF NOT EXISTS text_blasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  segment TEXT NOT NULL DEFAULT 'all' CHECK (segment IN ('all', 'confirmed', 'waitlist', 'checked_in', 'not_checked_in')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_text_blasts_event ON text_blasts (event_id, created_at DESC);

-- 7. QUICK CREATE — no new tables needed, just a simplified API endpoint

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvp_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvp_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_blasts ENABLE ROW LEVEL SECURITY;

-- Public read for event-facing tables
CREATE POLICY "comments_public_read" ON event_comments FOR SELECT USING (true);
CREATE POLICY "photos_public_read" ON event_photos FOR SELECT USING (true);
CREATE POLICY "interest_public_read" ON event_interest FOR SELECT USING (true);
CREATE POLICY "rsvp_questions_public_read" ON event_rsvp_questions FOR SELECT USING (true);
CREATE POLICY "organizer_profiles_public_read" ON organizer_profiles FOR SELECT USING (true);
CREATE POLICY "organizer_followers_public_read" ON organizer_followers FOR SELECT USING (true);

-- Answers only visible to organizers (via service role)
CREATE POLICY "rsvp_answers_no_public" ON event_rsvp_answers FOR SELECT USING (false);

-- Text blasts only visible to organizers (via service role)
CREATE POLICY "text_blasts_no_public" ON text_blasts FOR SELECT USING (false);

-- Comment likes: public read
CREATE POLICY "comment_likes_public_read" ON comment_likes FOR SELECT USING (true);
