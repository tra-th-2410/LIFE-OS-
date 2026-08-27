'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Loader2,
  Sparkles,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { initials } from '@/lib/helpers';
import type { Profile, Friendship } from '@/lib/types';
import { toast } from 'sonner';

interface FriendsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FriendsDialog({ open, onOpenChange }: FriendsDialogProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'find'>('friends');
  const [friends, setFriends] = useState<(Friendship & { profile: Profile })[]>([]);
  const [pendingReceived, setPendingReceived] = useState<(Friendship & { profile: Profile })[]>([]);
  const [pendingSent, setPendingSent] = useState<(Friendship & { profile: Profile })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadFriendships = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load all friendships involving current user
      const { data: rows } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const list = (rows as Friendship[]) ?? [];
      const userIdsToFetch = new Set<string>();

      list.forEach((f) => {
        const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
        userIdsToFetch.add(otherId);
      });

      let profilesMap = new Map<string, Profile>();
      if (userIdsToFetch.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(userIdsToFetch));

        (profs as Profile[] | null)?.forEach((p) => profilesMap.set(p.id, p));
      }

      const acceptedList: (Friendship & { profile: Profile })[] = [];
      const receivedList: (Friendship & { profile: Profile })[] = [];
      const sentList: (Friendship & { profile: Profile })[] = [];

      list.forEach((f) => {
        const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
        const prof = profilesMap.get(otherId) || {
          id: otherId,
          username: 'User',
          full_name: null,
          avatar_url: null,
          bio: null,
          interests: [],
          skills: [],
          goals: [],
          profile_visibility: 'public',
          date_of_birth: null,
          country: null,
          province: null,
          verification_status: 'basic',
          timezone: null,
          created_at: '',
          updated_at: '',
        };

        if (f.status === 'accepted') {
          acceptedList.push({ ...f, profile: prof });
        } else if (f.status === 'pending') {
          if (f.friend_id === user.id) {
            receivedList.push({ ...f, profile: prof });
          } else {
            sentList.push({ ...f, profile: prof });
          }
        }
      });

      setFriends(acceptedList);
      setPendingReceived(receivedList);
      setPendingSent(sentList);
    } catch {
      // Error fallback
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      loadFriendships();
    }
  }, [open, loadFriendships]);

  // Search people to add
  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .ilike('username', `%${searchQuery.trim()}%`)
        .limit(10);

      setSearchResults((data as Profile[]) ?? []);
    } catch {
      toast.error('Lỗi khi tìm kiếm');
    } finally {
      setSearching(false);
    }
  };

  // Send friend request
  const handleSendRequest = async (targetUser: Profile) => {
    if (!user) return;
    setActionId(targetUser.id);
    try {
      const { error } = await supabase.from('friendships').insert({
        user_id: user.id,
        friend_id: targetUser.id,
        status: 'pending',
      });

      if (error) throw error;
      toast.success(`Đã gửi lời mời kết bạn đến ${targetUser.username}!`);
      loadFriendships();
    } catch {
      toast.error('Không thể gửi lời mời hoặc đã tồn tại kết nối.');
    } finally {
      setActionId(null);
    }
  };

  // Accept request
  const handleAcceptRequest = async (friendshipId: string, username: string) => {
    setActionId(friendshipId);
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId);

      if (error) throw error;
      toast.success(`Đã chấp nhận lời mời từ ${username}! Giờ đây bạn có thể thấy nhật ký của nhau.`);
      loadFriendships();
    } catch {
      toast.error('Không thể chấp nhận lời mời.');
    } finally {
      setActionId(null);
    }
  };

  // Reject or Remove friend
  const handleRemoveFriendship = async (friendshipId: string, isReject: boolean = false) => {
    setActionId(friendshipId);
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      toast.success(isReject ? 'Đã từ chối lời mời kết bạn' : 'Đã hủy kết bạn');
      loadFriendships();
    } catch {
      toast.error('Không thể xử lý yêu cầu.');
    } finally {
      setActionId(null);
    }
  };

  const getFriendshipStateWith = (otherUserId: string) => {
    const isFriend = friends.some((f) => f.profile.id === otherUserId);
    if (isFriend) return 'friend';
    const isSent = pendingSent.some((f) => f.profile.id === otherUserId);
    if (isSent) return 'sent';
    const isReceived = pendingReceived.some((f) => f.profile.id === otherUserId);
    if (isReceived) return 'received';
    return 'none';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Kết nối bạn bè & Chia sẻ Nhật ký
          </DialogTitle>
          <DialogDescription>
            Kết nối với bạn bè cùng trường để cùng chia sẻ hành trình học tập và trao đổi qua Nhật ký.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'friends'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Bạn bè ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
              activeTab === 'requests'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Lời mời ({pendingReceived.length})
            {pendingReceived.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('find')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
              activeTab === 'find'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Search className="h-3.5 w-3.5" /> Tìm bạn mới
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 pt-2">
          {loading ? (
            <div className="space-y-2 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl animate-shimmer bg-muted/40" />
              ))}
            </div>
          ) : activeTab === 'friends' ? (
            friends.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                <Users className="h-8 w-8 mx-auto opacity-40" />
                <p>Bạn chưa có bạn bè kết nối nào.</p>
                <Button size="sm" variant="outline" onClick={() => setActiveTab('find')} className="gap-1.5">
                  <UserPlus className="h-4 w-4" /> Tìm và kết nối ngay
                </Button>
              </div>
            ) : (
              friends.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/60"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {initials(item.profile.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{item.profile.username}</p>
                        {item.profile.verification_status === 'verified' && (
                          <Badge className="bg-success/10 text-success text-[10px] px-1.5 py-0">
                            Verified
                          </Badge>
                        )}
                      </div>
                      {item.profile.bio && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.profile.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionId === item.id}
                    onClick={() => handleRemoveFriendship(item.id, false)}
                    className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Hủy kết bạn
                  </Button>
                </div>
              ))
            )
          ) : activeTab === 'requests' ? (
            pendingReceived.length === 0 && pendingSent.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Không có lời mời kết bạn nào đang chờ xử lý.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReceived.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      Lời mời đã nhận ({pendingReceived.length})
                    </p>
                    {pendingReceived.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/15 text-primary font-bold">
                              {initials(item.profile.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-sm">{item.profile.username}</p>
                            <p className="text-xs text-muted-foreground">Muốn kết nối cùng bạn</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            disabled={actionId === item.id}
                            onClick={() => handleAcceptRequest(item.id, item.profile.username)}
                            className="gap-1 text-xs"
                          >
                            <Check className="h-3.5 w-3.5" /> Chấp nhận
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionId === item.id}
                            onClick={() => handleRemoveFriendship(item.id, true)}
                            className="text-xs"
                          >
                            Từ chối
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pendingSent.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      Lời mời đã gửi ({pendingSent.length})
                    </p>
                    {pendingSent.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                              {initials(item.profile.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{item.profile.username}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Đang chờ phản hồi
                            </p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionId === item.id}
                          onClick={() => handleRemoveFriendship(item.id, true)}
                          className="text-xs text-muted-foreground"
                        >
                          Hủy lời mời
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Nhập username bạn học muốn tìm..."
                  className="text-sm"
                />
                <Button size="sm" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 pt-2">
                  {searchResults.map((p) => {
                    const state = getFriendshipStateWith(p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/60"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {initials(p.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{p.username}</p>
                              {p.verification_status === 'verified' && (
                                <Badge className="bg-success/10 text-success text-[10px] px-1.5 py-0">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            {p.bio && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{p.bio}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          {state === 'friend' ? (
                            <Badge variant="outline" className="text-xs text-success bg-success/10 border-success/20 gap-1">
                              <UserCheck className="h-3.5 w-3.5" /> Bạn bè
                            </Badge>
                          ) : state === 'sent' ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Clock className="h-3 w-3" /> Đã gửi lời mời
                            </Badge>
                          ) : state === 'received' ? (
                            <Badge variant="outline" className="text-xs text-primary bg-primary/10">
                              Đang chờ bạn duyệt
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              disabled={actionId === p.id}
                              onClick={() => handleSendRequest(p)}
                              className="gap-1 text-xs"
                            >
                              {actionId === p.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5" />
                              )}
                              Kết bạn
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
