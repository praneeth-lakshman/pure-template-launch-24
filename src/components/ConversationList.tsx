import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, User, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  tutor_id: string;
  tutor_name: string;
  service_type?: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  last_message?: {
    content: string;
    sender_type: string;
    created_at: string;
  };
}

interface ConversationListProps {
  userId: string;
}

const ConversationList = ({ userId }: ConversationListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<'Student' | 'Tutor' | null>(null);
  const [lastReadTimes, setLastReadTimes] = useState<{[conversationId: string]: string}>({});
  const { toast } = useToast();

  useEffect(() => {
    // Scroll to top when entering messages page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    loadUserTypeAndConversations();
    loadLastReadTimes();

    // Listen for read status changes from other components
    const handleMessagesRead = () => {
      loadLastReadTimes(); // Refresh the lastReadTimes from localStorage
      loadUserTypeAndConversations();
    };
    window.addEventListener('messagesMarkedAsRead', handleMessagesRead);

    return () => {
      window.removeEventListener('messagesMarkedAsRead', handleMessagesRead);
    };
  }, [userId]);

  const loadLastReadTimes = () => {
    const stored = localStorage.getItem(`lastReadTimes_${userId}`);
    if (stored) {
      setLastReadTimes(JSON.parse(stored));
    }
  };

  const loadUserTypeAndConversations = async () => {
    try {
      const readTimes = JSON.parse(localStorage.getItem(`lastReadTimes_${userId}`) || '{}');
      setLastReadTimes(readTimes);
      // First, get user type
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      const currentUserType = profile?.user_type?.toLowerCase() === 'tutor' ? 'Tutor' : 'Student';
      setUserType(currentUserType);

      // Then load conversations based on user type
      let query = supabase
        .from('conversations')
        .select(`
          *,
          messages!inner(content, sender_type, created_at)
        `);

      // Filter conversations where user is either client or tutor (regardless of user type)
      // This handles cases where roles can be assigned flexibly based on who initiated
      query = query.or(`client_id.eq.${userId},tutor_id.eq.${userId}`);

      const { data: convos, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      // Process conversations to add last message and unread count
      const processedConvos = (convos || []).map(convo => {
        const conversationMessages = convo.messages || [];
        const lastMessage = conversationMessages.length > 0 
          ? conversationMessages[conversationMessages.length - 1]
          : null;
        
        // Calculate unread count based on last read time
        const lastReadTime = readTimes[convo.id];
        let unreadCount = 0;
        
        if (lastReadTime) {
          // Count messages after last read time from the other party
          const otherPartyType = currentUserType === 'Tutor' ? 'client' : 'tutor';
          unreadCount = conversationMessages.filter(msg => 
            msg.sender_type === otherPartyType && 
            new Date(msg.created_at) > new Date(lastReadTime)
          ).length;
        } else {
          // If never read, count all messages from the other party
          const otherPartyType = currentUserType === 'Tutor' ? 'client' : 'tutor';
          unreadCount = conversationMessages.filter(msg => 
            msg.sender_type === otherPartyType
          ).length;
        }

        return {
          ...convo,
          last_message: lastMessage,
          unread_count: unreadCount,
          messages: undefined // Remove messages from the object to keep it clean
        };
      });

      setConversations(processedConvos);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h`;
    if (diffInHours < 48) return 'yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getOtherPersonInfo = (conversation: Conversation) => {
    if (userType === 'Tutor') {
      return {
        name: conversation.client_name,
        role: conversation.service_type ? `${conversation.service_type} Student` : 'Student',
        otherUserId: conversation.client_id
      };
    } else {
      return {
        name: conversation.tutor_name,
        role: 'Tutor',
        otherUserId: conversation.tutor_id
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-primary px-4 py-4 text-primary-foreground">
          <h1 className="text-xl font-semibold">Messages</h1>
          <p className="text-sm text-primary-foreground/70">{conversations.length} conversations</p>
        </div>

        {/* Conversations List */}
        <div className="bg-background">
          {conversations.length === 0 ? (
            <div className="text-center py-20 px-4">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No conversations yet</h3>
              <p className="text-muted-foreground text-sm">
                Start a conversation with a tutor to see it here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conversation) => {
                const otherPerson = getOtherPersonInfo(conversation);
                return (
                  <Link
                    key={conversation.id}
                    to={`/chat/${otherPerson.otherUserId}?conversation=${conversation.id}`}
                    className="block hover:bg-muted/50 transition-colors no-underline"
                    onClick={() => {
                      const key = `lastReadTimes_${userId}`;
                      const times = JSON.parse(localStorage.getItem(key) || '{}');
                      times[conversation.id] = new Date().toISOString();
                      localStorage.setItem(key, JSON.stringify(times));
                      window.dispatchEvent(new CustomEvent('messagesMarkedAsRead'));
                    }}
                  >
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-gradient-hero rounded-full flex items-center justify-center flex-shrink-0">
                        {userType === 'Student' ? (
                          <GraduationCap className="h-6 w-6 text-white" />
                        ) : (
                          <User className="h-6 w-6 text-white" />
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground truncate">
                            {otherPerson.name}
                          </h3>
                          <div className="flex items-center gap-2 ml-2">
                            {conversation.last_message && (
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(conversation.last_message.created_at)}
                              </span>
                            )}
                            {conversation.unread_count && conversation.unread_count > 0 && (
                              <Badge variant="destructive" className="min-w-[20px] h-5 text-xs px-1.5 bg-red-500 hover:bg-red-500 rounded-full">
                                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-1">{otherPerson.role}</p>
                        
                        {conversation.last_message && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.last_message.sender_type === (userType === 'Tutor' ? 'tutor' : 'client') && "You: "}
                            {conversation.last_message.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationList;
