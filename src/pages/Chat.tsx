

import { useParams, Link, Navigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, MessageSquare, GraduationCap, User } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const Chat = () => {
  const { tutorId } = useParams<{ tutorId: string }>();
  const { user, loading: authLoading } = useAuth();
  
  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <ChatInterface tutorId={tutorId} user={user} />;
};

const ChatInterface = ({ tutorId, user }: { tutorId: string | undefined; user: any }) => {
  const [messageInput, setMessageInput] = useState('');
  const [otherPerson, setOtherPerson] = useState<any>(null);
  const [personLoading, setPersonLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Initialize chat hooks after authentication is confirmed
  const { conversation, messages, loading, sending, initializeConversation, sendMessage } = useChat();

  // Load the other person in the conversation
  useEffect(() => {
    const loadOtherPerson = async () => {
      if (!tutorId || !user?.id) {
        setPersonLoading(false);
        return;
      }

      
      

      try {
        // First get current user's type
        const { data: currentUserProfile, error: userError } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .maybeSingle();

        if (userError) throw userError;

        const currentUserType = currentUserProfile?.user_type?.toLowerCase();

        // Load the other person's profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', tutorId)
          .maybeSingle();

        if (error || !profile) {
          // Try to enrich from conversation if available in URL
          const urlParams = new URLSearchParams(window.location.search);
          const conversationId = urlParams.get('conversation');
          let name = 'User';
          let role = 'Student';

          if (conversationId) {
            const { data: convo, error: convoError } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', conversationId)
              .maybeSingle();

            if (convo) {
              const isOtherTutor = convo.tutor_id === tutorId;
              role = isOtherTutor ? 'Tutor' : 'Student';
              name = isOtherTutor ? (convo.tutor_name || 'User') : (convo.client_name || 'User');
            }
          }

          setOtherPerson({
            id: tutorId,
            name,
            role,
            university: 'University',
            course: 'Course',
            year: 'Year',
            specialties: [],
            examRates: {}
          });
        } else {
          // Handle subjects data structure safely
          let specialties: string[] = [];
          if (profile.subjects && typeof profile.subjects === 'object' && !Array.isArray(profile.subjects)) {
            const subjectsObj = profile.subjects as { [key: string]: any };
            if (subjectsObj.exams && Array.isArray(subjectsObj.exams)) {
              specialties = subjectsObj.exams;
            }
          } else if (Array.isArray(profile.subjects)) {
            specialties = profile.subjects as string[];
          }

          // Determine role based on user type in profile
          const profileUserType = profile.user_type?.toLowerCase();
          const isProfileTutor = profileUserType === 'tutor';

          setOtherPerson({
            id: profile.id,
            name: profile.name || (isProfileTutor ? 'Anonymous Tutor' : 'Anonymous Student'),
            role: isProfileTutor ? 'Tutor' : 'Student',
            university: profile.university || 'University',
            course: profile.degree || 'Course',
            year: profile.year || 'Year',
            specialties,
            examRates: profile.exam_rates || {}
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setOtherPerson(null);
      } finally {
        setPersonLoading(false);
      }
    };

    loadOtherPerson();
  }, [tutorId, user?.id]);

  // Mark messages as read when entering conversation
  const markMessagesAsRead = useCallback((conversationId: string) => {
    if (!user?.id || !conversationId) return;
    
    // Update localStorage with current timestamp for this conversation
    const lastReadKey = `lastReadTimes_${user.id}`;
    const lastReadTimes = JSON.parse(localStorage.getItem(lastReadKey) || '{}');
    lastReadTimes[conversationId] = new Date().toISOString();
    localStorage.setItem(lastReadKey, JSON.stringify(lastReadTimes));
    
    // Dispatch event to notify Navigation component to refresh unread count
    window.dispatchEvent(new CustomEvent('messagesMarkedAsRead'));
  }, [user?.id]);

  // Initialize conversation when component mounts
  useEffect(() => {
    if (otherPerson?.id && user?.id) {
      // Get service type and conversation ID from URL query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const serviceType = urlParams.get('service');
      const conversationId = urlParams.get('conversation');
      
      // Always pass the other person's data - the useChat hook will handle role logic
      initializeConversation(user.id, { 
        id: otherPerson.id, 
        name: otherPerson.name, 
        service: serviceType || undefined 
      });
    }
  }, [otherPerson?.id, user?.id, initializeConversation]); // Only depend on IDs, not full objects

  // Mark messages as read when conversation is loaded
  useEffect(() => {
    if (conversation?.id && messages.length > 0) {
      markMessagesAsRead(conversation.id);
    }
  }, [conversation?.id, messages.length, markMessagesAsRead]);

  // Scroll to top when entering chat
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Scroll to bottom only when new messages are added (not on initial load)
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      // Only auto-scroll if user is near bottom or if this is a new message being added
      const isNearBottom = window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - 100;
      if (isNearBottom) {
        messagesEndRef.current.scrollIntoView();
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending) return;

    await sendMessage(messageInput, user.id);
    setMessageInput('');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (loading || personLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!otherPerson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold text-foreground mb-4">Person Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The requested person could not be found.
            </p>
            <Button asChild>
              <Link to="/team">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Team
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-hero rounded-full flex items-center justify-center">
              {otherPerson.role === 'Tutor' ? (
                <GraduationCap className="h-6 w-6 text-white" />
              ) : (
                <User className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold">Chat with {otherPerson.name}</h1>
              <p className="text-muted-foreground text-sm">
                {otherPerson.role === 'Tutor' 
                  ? `${otherPerson.year} ${otherPerson.course} Student at ${otherPerson.university}`
                  : otherPerson.role
                }
              </p>
            </div>
          </div>
          
          <Button variant="ghost" asChild>
            <Link to="/messages">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Messages
            </Link>
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="relative flex-1">
        <div 
          ref={messagesContainerRef}
          className="h-full overflow-y-auto p-4 space-y-4" 
          style={{ minHeight: 'calc(100vh - 140px)' }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Start your conversation with {otherPerson.name}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {otherPerson.role === 'Tutor' 
                  ? "Ask questions about their tutoring services, availability, or any other queries you might have."
                  : "Start your conversation about tutoring services or academic support."
                }
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.sender_type === 'client' ? "justify-end" : "justify-start"
                )}
              >
                {message.sender_type === 'tutor' && (
                  <div className="w-8 h-8 bg-gradient-hero rounded-full flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="h-4 w-4 text-white" />
                  </div>
                )}
                
                <div
                  className="max-w-[70%] rounded-lg px-4 py-2 bg-primary text-white"
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs mt-1 opacity-70 text-white">
                    {formatTime(message.created_at)}
                  </p>
                </div>

                {message.sender_type === 'client' && (
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input - Fixed positioning for mobile */}
      <div className="flex-shrink-0 border-t border-border p-4 bg-background sticky bottom-0 w-full">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type your message..."
            disabled={sending}
            maxLength={1000}
            aria-label="Message input"
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!messageInput.trim() || sending}
            size="icon"
            className="flex-shrink-0"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        
        {/* Info Text */}
        <p className="text-xs text-muted-foreground text-center mt-2">
          💡 This is a direct message. {otherPerson.role === 'Tutor' ? "They'll respond as soon as they're available. Free taster lessons available!" : "Feel free to discuss tutoring opportunities."}
        </p>
      </div>
    </div>
  );
};

export default Chat;
