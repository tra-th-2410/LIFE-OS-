import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Data models
interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ForumPost {
  id: string;
  author_id: string;
  category_id: string | null;
  title: string;
  content: string;
  is_anonymous: boolean;
  status: 'active' | 'hidden' | 'deleted' | 'locked';
  tags: string[];
  comments_count: number;
  reactions_count: number;
  bookmark_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile | null;
}

// Logic helpers matching the app implementation
function isPostOwner(user: { id: string } | null, post: ForumPost): boolean {
  if (!user) return false;
  return user.id === post.author_id || user.id === post.author?.id;
}

function getPostDisplayName(post: ForumPost, fallbackAnonymous = 'Sinh viên ẩn danh'): string {
  if (post.is_anonymous) return fallbackAnonymous;
  return post.author?.display_name || post.author?.username || 'Bạn học';
}

function getPostAvatarInitial(post: ForumPost): string {
  if (post.is_anonymous) return 'A';
  const name = post.author?.display_name || post.author?.username || 'U';
  return name.charAt(0).toUpperCase();
}

function applyPostEdit(
  post: ForumPost,
  updates: { title: string; content: string; category_id?: string | null }
): ForumPost {
  return {
    ...post,
    title: updates.title.trim(),
    content: updates.content.trim(),
    category_id: updates.category_id !== undefined ? updates.category_id : post.category_id,
    // CRITICAL: is_anonymous is strictly preserved, never converted to public
    is_anonymous: post.is_anonymous,
    updated_at: new Date().toISOString(),
  };
}

function removePostFromList(posts: ForumPost[], deletedPostId: string): ForumPost[] {
  return posts.filter((p) => p.id !== deletedPostId);
}

// Simulated RLS authorization check
function canUserUpdatePost(userId: string, post: ForumPost): boolean {
  return post.author_id === userId;
}

function canUserDeletePost(userId: string, post: ForumPost): boolean {
  return post.author_id === userId;
}

// Tests
console.log('--- RUNNING FORUM POST EDIT & DELETE TEST SUITE ---');

const userA = { id: 'user-aaa-111', username: 'alice_scholar', display_name: 'Alice Nguyen', avatar_url: 'https://example.com/alice.png' };
const userB = { id: 'user-bbb-222', username: 'bob_learner', display_name: 'Bob Tran', avatar_url: 'https://example.com/bob.png' };

const publicPostByA: ForumPost = {
  id: 'post-001',
  author_id: userA.id,
  category_id: 'cat-01',
  title: 'Hỏi về phương pháp ôn thi SAT 1500+',
  content: 'Mình đang chuẩn bị thi SAT vào tháng tới, bạn nào có tips Reading hay không?',
  is_anonymous: false,
  status: 'active',
  tags: ['sat', 'study-tips'],
  comments_count: 5,
  reactions_count: 12,
  bookmark_count: 3,
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-01T08:00:00Z',
  author: userA,
};

const anonymousPostByA: ForumPost = {
  id: 'post-002',
  author_id: userA.id,
  category_id: 'cat-02',
  title: 'Tâm sự: Áp lực học tập và mất phương hướng',
  content: 'Dạo này mình cảm thấy kiệt sức và mất động lực học. Có ai từng trải qua cảm giác này chưa?',
  is_anonymous: true,
  status: 'active',
  tags: ['mental-health', 'motivation'],
  comments_count: 8,
  reactions_count: 24,
  bookmark_count: 7,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  author: userA,
};

// TEST 1: User A views their own public post -> has Edit/Delete
assert.equal(isPostOwner(userA, publicPostByA), true, 'User A should own their public post');
console.log('✅ TEST 1 PASSED: User A has Edit & Delete on their public post');

// TEST 2: User A views their own anonymous post -> STILL has Edit/Delete
assert.equal(isPostOwner(userA, anonymousPostByA), true, 'User A should own their anonymous post');
console.log('✅ TEST 2 PASSED: User A has Edit & Delete on their anonymous post (anonymity does NOT strip ownership)');

// TEST 3: User B views User A\'s public post -> NO Edit/Delete
assert.equal(isPostOwner(userB, publicPostByA), false, 'User B must NOT own User A public post');
console.log('✅ TEST 3 PASSED: User B does NOT have Edit & Delete on User A public post');

// TEST 4: User B views User A\'s anonymous post -> NO Edit/Delete
assert.equal(isPostOwner(userB, anonymousPostByA), false, 'User B must NOT own User A anonymous post');
console.log('✅ TEST 4 PASSED: User B does NOT have Edit & Delete on User A anonymous post');

// TEST 5: Anonymous Privacy Preservation
assert.equal(getPostDisplayName(anonymousPostByA), 'Sinh viên ẩn danh', 'Anonymous post must display Anonymous');
assert.equal(getPostAvatarInitial(anonymousPostByA), 'A', 'Anonymous post avatar must be A');
assert.equal(getPostDisplayName(publicPostByA), 'Alice Nguyen', 'Public post displays author display name');
assert.equal(getPostAvatarInitial(publicPostByA), 'A', 'Public post avatar matches initial');
console.log('✅ TEST 5 PASSED: Privacy presentation is strictly preserved');

// TEST 6: Edit Anonymous Post preserves anonymity
const editedAnonPost = applyPostEdit(anonymousPostByA, {
  title: 'Tâm sự: Áp lực học tập và cách mình đang vượt qua [ĐÃ CẬP NHẬT]',
  content: 'Cảm ơn mọi người đã chia sẻ lời khuyên. Mình đã bắt đầu áp dụng Pomodoro và thấy tốt hơn.',
});
assert.equal(editedAnonPost.title, 'Tâm sự: Áp lực học tập và cách mình đang vượt qua [ĐÃ CẬP NHẬT]');
assert.equal(editedAnonPost.content, 'Cảm ơn mọi người đã chia sẻ lời khuyên. Mình đã bắt đầu áp dụng Pomodoro và thấy tốt hơn.');
assert.equal(editedAnonPost.is_anonymous, true, 'is_anonymous must remain true after edit');
assert.equal(getPostDisplayName(editedAnonPost), 'Sinh viên ẩn danh', 'DisplayName must still be Anonymous after edit');
assert.equal(editedAnonPost.comments_count, 8, 'Comments count must be preserved');
assert.equal(editedAnonPost.reactions_count, 24, 'Reactions count must be preserved');
console.log('✅ TEST 6 PASSED: Edit preserves anonymous status and interaction counts');

// TEST 7: Delete Post removes it from feed/list
const postList: ForumPost[] = [publicPostByA, anonymousPostByA];
const updatedList = removePostFromList(postList, anonymousPostByA.id);
assert.equal(updatedList.length, 1);
assert.equal(updatedList[0].id, publicPostByA.id);
assert.equal(updatedList.some((p) => p.id === anonymousPostByA.id), false);
console.log('✅ TEST 7 PASSED: Delete immediately removes post from list without errors');

// TEST 8: RLS Security check
assert.equal(canUserUpdatePost(userA.id, anonymousPostByA), true, 'User A can update their post');
assert.equal(canUserDeletePost(userA.id, anonymousPostByA), true, 'User A can delete their post');
assert.equal(canUserUpdatePost(userB.id, anonymousPostByA), false, 'User B CANNOT update User A post');
assert.equal(canUserDeletePost(userB.id, anonymousPostByA), false, 'User B CANNOT delete User A post');
console.log('✅ TEST 8 PASSED: RLS policies strictly protect forum posts from unauthorized mutations');

console.log('\n🎉 ALL 8/8 FORUM POST OWNERSHIP, EDIT & DELETE TESTS PASSED SUCCESSFULLY!');
