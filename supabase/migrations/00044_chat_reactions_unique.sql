-- Prevent duplicate reactions (same user, same emoji, same message)
ALTER TABLE chat_reactions ADD CONSTRAINT unique_reaction UNIQUE(message_id, user_id, emoji);
