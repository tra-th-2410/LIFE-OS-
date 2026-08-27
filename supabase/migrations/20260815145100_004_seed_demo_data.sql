/*
# Seed Demo Communities & Challenges

Inserts demo communities and challenges for testing.
Uses ON CONFLICT DO NOTHING for idempotency.
Note: These are created without a created_by (NULL) since they're system-seeded.
The communities_select policy allows all authenticated users to read public communities.
*/

-- Insert demo communities (created_by is NULL for system-seeded)
INSERT INTO communities (name, slug, description, icon, color, is_private, is_anonymous, members_count)
VALUES
  ('Programming', 'programming', 'Learn to code, share your projects, debug together, and discuss all things programming.', '💻', 'blue', false, false, 12400),
  ('Anime & Manga', 'anime-manga', 'Discuss your favorite anime and manga series, share recommendations, and connect with fellow fans.', '🎌', 'rose', false, false, 8700),
  ('Gaming', 'gaming', 'Find teammates, share clips, discuss games, and organize gaming sessions.', '🎮', 'purple', false, false, 15200),
  ('Music', 'music', 'Discover new artists, share playlists, discuss music theory, and collaborate on musical projects.', '🎵', 'amber', false, false, 6300),
  ('Art & Design', 'art-design', 'Show your artwork, get feedback, learn new techniques, and find inspiration.', '🎨', 'orange', false, false, 4800),
  ('Science', 'science', 'Explore the wonders of the natural world, discuss research, and learn together.', '🔬', 'teal', false, false, 5100),
  ('Books', 'books', 'Book clubs, reviews, reading challenges, and literary discussions.', '📚', 'green', false, false, 3200),
  ('Heart to Heart', 'heart-to-heart', 'Anonymous space to share feelings, support each other, and talk through tough times.', '💬', 'cyan', false, true, 7900)
ON CONFLICT (slug) DO NOTHING;

-- Insert demo challenges
INSERT INTO challenges (title, description, type, duration_days, icon, color, participants_count)
VALUES
  ('7-Day English Challenge', 'Learn 10 new English words every day for a week. Build your vocabulary one day at a time.', 'english', 7, '🌍', 'blue', 342),
  ('30-Day Reading Challenge', 'Read for at least 20 minutes every day for a month. Track your progress and share what you''re reading.', 'reading', 30, '📖', 'amber', 891),
  ('14-Day Coding Challenge', 'Solve one coding problem every day for two weeks. Build your problem-solving skills.', 'coding', 14, '⚡', 'purple', 527),
  ('21-Day Exercise Challenge', '15 minutes of movement every day for three weeks. Build a sustainable exercise habit.', 'exercise', 21, '🏃', 'green', 438),
  ('7-Day Study Challenge', 'Study for at least 2 hours every day for a week. Perfect before exams.', 'study', 7, '📝', 'teal', 612)
ON CONFLICT DO NOTHING;
