export type ProfileVisibility = 'public' | 'friends' | 'private';
export type CommunityRole = 'member' | 'moderator' | 'owner';
export type PostType = 'text' | 'image' | 'poll' | 'link';
export type GoalCategory = 'study' | 'health' | 'skill' | 'personal' | 'project';
export type GoalStatus = 'active' | 'completed' | 'abandoned';
export type ProjectStatus = 'recruiting' | 'active' | 'completed' | 'paused';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved';
export type MessageRole = 'user' | 'assistant';
export type BotType = 'learning' | 'writing' | 'project' | 'career';
export type VerificationStatus = 'basic' | 'pending' | 'verified' | 'rejected';
export type VerificationMethod = 'school_email' | 'student_id' | 'school_verification';
export type VerificationReviewStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[];
  skills: string[];
  goals: string[];
  profile_visibility: ProfileVisibility;
  date_of_birth: string | null;
  country: string | null;
  province: string | null;
  verification_status: VerificationStatus;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentVerification {
  id: string;
  user_id: string;
  status: VerificationReviewStatus;
  method: VerificationMethod;
  school_email: string | null;
  school_name: string | null;
  country: string | null;
  province: string | null;
  grade_or_year: string | null;
  student_id_url: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRow {
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  is_private: boolean;
  is_anonymous: boolean;
  members_count: number;
  created_by: string | null;
  created_at: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: CommunityRole;
  joined_at: string;
}

export interface Post {
  id: string;
  community_id: string;
  author_id: string;
  title: string | null;
  content: string;
  type: PostType;
  is_anonymous: boolean;
  poll_options: string[] | null;
  poll_votes: Record<string, number> | null;
  image_url: string | null;
  link_url: string | null;
  comments_count: number;
  reactions_count: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  is_anonymous: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  progress: number;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

export type HabitCategory = 'study' | 'health' | 'mindfulness' | 'language' | 'skill' | 'routine';

export interface HabitTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: HabitCategory;
  default_frequency: string;
  sort_order: number;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  frequency: string;
  streak: number;
  category?: HabitCategory;
  is_archived?: boolean;
  target_days?: number;
  created_at: string;
  updated_at?: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  completed_date: string;
  created_at: string;
}

export type MoodTrend = 'improving' | 'stable' | 'declining' | 'mixed';

export interface MoodEntry {
  id: string;
  user_id: string;
  mood: number;
  note: string | null;
  tags: string[];
  created_at: string;
}

export interface MoodWeeklySummary {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  avg_mood: number;
  positive_days_count: number;
  neutral_days_count: number;
  difficult_days_count: number;
  trend: MoodTrend;
  summary_text: string;
  encouragement: string;
  habit_suggestions: string[];
  created_at: string;
}

export type JournalVisibility = 'private' | 'friends' | 'public';

export interface JournalPostAttachment {
  id: string;
  journal_id: string;
  uploader_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  is_image: boolean;
  created_at: string;
}

export interface JournalPostReaction {
  id: string;
  journal_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

export interface JournalPostComment {
  id: string;
  journal_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  author?: Profile | null;
  created_at: string;
  updated_at: string;
}

export interface JournalPostShare {
  id: string;
  journal_id: string;
  shared_by: string;
  shared_to_user_id: string | null;
  caption: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  mood: number | null;
  is_private: boolean;
  visibility?: JournalVisibility;
  tags?: string[];
  image_url?: string | null;
  reactions_count?: number;
  comments_count?: number;
  ai_analysis?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryWithRelations extends JournalEntry {
  author?: Profile | null;
  attachments?: JournalPostAttachment[];
  reactions?: JournalPostReaction[];
  comments?: JournalPostComment[];
}

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  friend_profile?: Profile | null;
  user_profile?: Profile | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  status: ProjectStatus;
  progress: number;
  deadline: string | null;
  roles_needed: string[];
  tags: string[];
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  order: number;
  created_at: string;
}

export type ChallengeCategory = 'study' | 'ielts' | 'math' | 'physics' | 'chemistry' | 'english' | 'reading' | 'hsg' | 'habit' | 'other';
export type ChallengeStatus = 'active' | 'completed' | 'archived';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: string;
  duration_days: number;
  icon: string;
  color: string;
  participants_count: number;
  creator_id: string | null;
  category: ChallengeCategory;
  start_date: string | null;
  status: ChallengeStatus;
  parent_challenge_id: string | null;
  created_at: string;
}

export interface ChallengeParticipant {
  challenge_id: string;
  user_id: string;
  progress: number;
  streak: number;
  joined_at: string;
  completed: boolean;
  round: number;
}

export interface ChallengeCheckin {
  id: string;
  challenge_id: string;
  user_id: string;
  checkin_date: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CommunityPostAttachment {
  id: string;
  post_id: string;
  community_id: string;
  uploader_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  is_image: boolean;
  created_at: string;
}

export interface CommunityPostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

export type ReactionType = '❤️' | '👍' | '😂' | '😮' | '😢' | '😡' | '🎉' | '🔥';

export interface PostWithRelations extends Post {
  author?: Profile | null;
  attachments?: CommunityPostAttachment[];
  reactions?: CommunityPostReaction[];
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
}

export interface AiConversation {
  id: string;
  user_id: string;
  bot_type: BotType;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export type ForumPostStatus = 'active' | 'hidden' | 'deleted' | 'locked';
export type ForumReactionType = 'helpful' | 'understand' | 'interesting' | 'well_done';
export type ForumReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sort_order: number;
  posts_count: number;
  created_at: string;
}

export interface ForumPost {
  id: string;
  author_id: string;
  category_id: string | null;
  title: string;
  content: string;
  is_anonymous: boolean;
  status: ForumPostStatus;
  image_url: string | null;
  tags: string[];
  comments_count: number;
  reactions_count: number;
  bookmark_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface ForumComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  is_anonymous: boolean;
  is_hidden: boolean;
  depth: number;
  created_at: string;
  updated_at: string;
}

export interface ForumReaction {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  user_id: string;
  reaction_type: ForumReactionType;
  created_at: string;
}

export interface ForumBookmark {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface VerificationAuditLog {
  id: string;
  verification_request_id: string;
  admin_id: string | null;
  action: 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

export interface ForumReport {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  status: ForumReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ForumPostAttachment {
  id: string;
  post_id: string;
  uploader_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  is_image: boolean;
  created_at: string;
}

export interface ForumPostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

// ----------------------------------------------------
// Quiz & Flashcard System Types
// ----------------------------------------------------

export type QuestionType = 'flashcard' | 'multiple_choice' | 'fill_blank';
export type StudySubject = 'math' | 'physics' | 'chemistry' | 'biology' | 'english' | 'literature' | 'history' | 'geography' | 'it' | 'other';
export type ProgressDifficulty = 'easy' | 'medium' | 'hard';
export type ProgressStatus = 'new' | 'learning' | 'reviewing' | 'mastered';
export type StudySessionMode = 'practice' | 'exam';

export interface StudySet {
  id: string;
  user_id: string | null;
  title: string;
  subject: StudySubject | string;
  topic: string | null;
  description: string | null;
  default_type?: QuestionType | string;
  is_system?: boolean;
  created_at: string;
  updated_at: string;
  questions_count?: number;
  mastered_count?: number;
}

export interface MultipleChoiceOptions {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface StudyQuestion {
  id: string;
  set_id: string;
  type: QuestionType;
  question: string;
  answer: string | null;
  explanation: string | null;
  options: MultipleChoiceOptions | null;
  correct_option: 'A' | 'B' | 'C' | 'D' | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StudyProgress {
  id: string;
  user_id: string;
  question_id: string;
  status: ProgressStatus;
  difficulty: ProgressDifficulty | null;
  next_review_at: string;
  correct_count: number;
  incorrect_count: number;
  last_reviewed_at: string | null;
}

export interface StudySession {
  id: string;
  user_id: string;
  set_id: string;
  mode: StudySessionMode;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  score: number;
  created_at: string;
}

export interface ExamAnswerRecord {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  isFlagged: boolean;
  timeSpentSeconds?: number;
}

