

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, X, ChevronDown, User, Settings, LogOut, MessageCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  // Fetch unread message count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        // Get user profile to determine user type
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .single();

        const userType = profile?.user_type?.toLowerCase() === 'tutor' ? 'Tutor' : 'Student';

        // Get conversations with messages
        let query = supabase
          .from('conversations')
          .select(`
            id,
            messages (
              id,
              created_at,
              sender_type
            )
          `);

        // Filter by user type
        if (userType === 'Tutor') {
          query = query.eq('tutor_id', user.id);
        } else {
          query = query.eq('client_id', user.id);
        }

        const { data: conversations } = await query;

        if (conversations) {
          // Get last read times from localStorage
          const lastReadTimes = JSON.parse(localStorage.getItem(`lastReadTimes_${user.id}`) || '{}');
          
          let totalUnreadCount = 0;
          
          conversations.forEach(convo => {
            const messages = convo.messages || [];
            const lastReadTime = lastReadTimes[convo.id];
            const otherPartyType = userType === 'Tutor' ? 'client' : 'tutor';
            
            let conversationUnreadCount = 0;
            
            if (lastReadTime) {
              // Count messages after last read time from the other party
              conversationUnreadCount = messages.filter(msg => 
                msg.sender_type === otherPartyType && 
                new Date(msg.created_at) > new Date(lastReadTime)
              ).length;
            } else {
              // If never read, count all messages from the other party
              conversationUnreadCount = messages.filter(msg => 
                msg.sender_type === otherPartyType
              ).length;
            }
            
            totalUnreadCount += conversationUnreadCount;
          });

          setUnreadCount(totalUnreadCount);
        }
      } catch (error) {
        // Silently handle error - unread count will remain 0
      }
    };

    fetchUnreadCount();

    // Set up real-time subscription for message updates
    const messagesSubscription = supabase
      .channel('nav-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Refresh unread count when new messages arrive
          fetchUnreadCount();
        }
      )
      .subscribe();

    // Also refresh when localStorage changes (when messages are read)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `lastReadTimes_${user.id}`) {
        fetchUnreadCount();
      }
    };

    // Listen for custom events from within the same window/tab
    const handleReadStatusUpdate = () => {
      fetchUnreadCount();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('messagesMarkedAsRead', handleReadStatusUpdate);

    return () => {
      supabase.removeChannel(messagesSubscription);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('messagesMarkedAsRead', handleReadStatusUpdate);
    };
  }, [user]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    }
  };

  const examItems = [
    { name: 'TMUA', path: '/tmua' },
    { name: 'MAT', path: '/mat' },
    { name: 'ESAT', path: '/esat' },
  ];

  const pastPapersItems = [
    { name: 'TMUA Past Papers', path: '/tmua/past-papers' },
    { name: 'MAT Past Papers', path: '/mat/past-papers' },
    { name: 'ESAT Past Papers', path: '/esat/past-papers' },
  ];

  const mockPapersItems = [
    { name: 'TMUA Mock Papers', path: '/tmua/mock-papers' },
    { name: 'ESAT Mock Papers', path: '/esat/mock-papers' },
  ];


  return (
    <nav className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link 
            to="/" 
            className="flex items-center space-x-2"
            onClick={(e) => {
              if (location.pathname === '/') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <img src="/loveable-uploads/89824f59-4b90-41ca-b98b-e502aca83a14.png" alt="Oxbridge & Imperial Prep" className="h-12" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {/* Exams Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary focus:text-primary active:text-primary text-muted-foreground no-underline touch-manipulation">
                Exams
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="bg-background border border-border shadow-lg z-[60] min-w-[200px]"
                sideOffset={8}
                align="start"
              >
                {examItems.map((item) => (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link 
                      to={item.path}
                      className="w-full px-3 py-3 text-sm hover:bg-muted active:bg-muted text-foreground no-underline touch-manipulation"
                    >
                      {item.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Past Papers Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary focus:text-primary active:text-primary text-muted-foreground no-underline touch-manipulation">
                Past Papers
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="bg-background border border-border shadow-lg z-[60] min-w-[200px]"
                sideOffset={8}
                align="start"
              >
                {pastPapersItems.map((item) => (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link 
                      to={item.path}
                      className="w-full px-3 py-3 text-sm hover:bg-muted active:bg-muted text-foreground no-underline touch-manipulation"
                    >
                      {item.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mock Papers Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary focus:text-primary active:text-primary text-muted-foreground no-underline touch-manipulation">
                Mock Papers
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="bg-background border border-border shadow-lg z-[60] min-w-[200px]"
                sideOffset={8}
                align="start"
              >
                {mockPapersItems.map((item) => (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link 
                      to={item.path}
                      className="w-full px-3 py-3 text-sm hover:bg-muted active:bg-muted text-foreground no-underline touch-manipulation"
                    >
                      {item.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Navigation items */}
            <Link
              to="/interview-prep"
              onClick={(e) => {
                if (location.pathname === '/interview-prep') {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`text-sm font-medium transition-colors hover:text-primary no-underline ${
                location.pathname === '/interview-prep'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              Interview Prep
            </Link>

            <Link
              to="/about"
              onClick={(e) => {
                if (location.pathname === '/about') {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  // Scroll to top on navigation
                  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                }
              }}
              className={`text-sm font-medium transition-colors hover:text-primary no-underline ${
                location.pathname === '/about'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              About Us
            </Link>
            
            {/* Login Button (when not logged in) */}
            {!loading && !user && (
              <Button 
                variant="outline"
                size="sm"
                asChild
              >
                <Link 
                  to="/login"
                  className="no-underline"
                  onClick={() => {
                    // Scroll to top on navigation
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                  }}
                >
                  Login
                </Link>
              </Button>
            )}

            {/* Meet the Team Button */}
            <Button 
              variant="default"
              asChild
            >
              <Link 
                to="/team"
                className="no-underline"
                onClick={(e) => {
                  if (location.pathname === '/team') {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    // Clear any hash from URL
                    window.history.pushState(null, '', '/team');
                  }
                }}
              >
                Book Now
              </Link>
            </Button>

            {/* Tutor Inbox Section (when logged in) */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 hover:opacity-80 active:opacity-80 transition-opacity touch-manipulation">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">Profile</span>
                    {unreadCount > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-48 z-[60] bg-background border border-border shadow-lg"
                  sideOffset={8}
                >
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 w-full">
                      <Settings className="h-4 w-4" />
                      Profile Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link 
                      to="/messages" 
                      className="flex items-center gap-2 w-full"
                      onClick={(e) => {
                        if (location.pathname === '/messages') {
                          e.preventDefault();
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      View Messages
                      {unreadCount > 0 && (
                        <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              className="touch-manipulation"
              aria-label={isOpen ? "Close menu" : "Open menu"}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-border">
              {/* Mobile Exams Section */}
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                Exams
              </div>
              {examItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`block pl-6 pr-3 py-2 text-sm font-medium transition-colors hover:text-primary no-underline ${
                    location.pathname === item.path
                      ? 'text-primary'
                      : 'text-foreground'
                  }`}
                  onClick={(e) => {
                    setIsOpen(false);
                    if (item.name === 'TMUA' && location.pathname === '/tmua') {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else if (item.name === 'MAT' && location.pathname === '/mat') {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else if (item.name === 'ESAT' && location.pathname === '/esat') {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                >
                  {item.name}
                </Link>
              ))}

              {/* Mobile Past Papers Section */}
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                Past Papers
              </div>
              {pastPapersItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className="block pl-6 pr-3 py-2 text-sm font-medium transition-colors hover:text-primary text-muted-foreground no-underline"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              {/* Mobile Mock Papers Section */}
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                Mock Papers
              </div>
              {mockPapersItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className="block pl-6 pr-3 py-2 text-sm font-medium transition-colors hover:text-primary text-muted-foreground no-underline"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              {/* Other navigation items */}
              <Link
                to="/interview-prep"
                className={`block px-3 py-2 text-sm font-medium transition-colors hover:text-primary no-underline ${
                  location.pathname === '/interview-prep'
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
                onClick={(e) => {
                  setIsOpen(false);
                  if (location.pathname === '/interview-prep') {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              >
                Interview Prep
              </Link>

              <Link
                to="/about"
                className={`block px-3 py-2 text-sm font-medium transition-colors hover:text-primary no-underline ${
                  location.pathname === '/about'
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
                onClick={(e) => {
                  setIsOpen(false);
                  if (location.pathname === '/about') {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    // Scroll to top on navigation
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                  }
                }}
              >
                About Us
              </Link>
               
               {/* Mobile Auth Section */}
               {user ? (
                 <>
                   <div className="px-3 py-2 text-sm font-medium text-muted-foreground border-t border-border">
                     {user.email}
                   </div>
                    
                    {/* Mobile Tutor Inbox Section */}
                    <Link
                      to="/messages"
                      className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border rounded-md hover:bg-muted no-underline"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Inbox
                        {unreadCount > 0 && (
                          <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </Link>
                    
                    <Link
                      to="/profile"
                      className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border rounded-md hover:bg-muted no-underline"
                      onClick={() => setIsOpen(false)}
                    >
                      Profile Settings
                    </Link>
                    <button
                      className="block w-full text-left px-3 py-2 text-sm font-medium text-destructive border border-border rounded-md hover:bg-muted"
                      onClick={() => {
                        setIsOpen(false);
                        handleLogout();
                      }}
                    >
                     Sign Out
                   </button>
                 </>
               ) : (
                  <Link
                    to="/login"
                    className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border rounded-md hover:bg-muted no-underline"
                    onClick={() => {
                      setIsOpen(false);
                      // Scroll to top on navigation
                      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                    }}
                  >
                    Login
                  </Link>
               )}

               {/* Mobile Team Button */}
               <Link
                 to="/team"
                 className="block px-3 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 no-underline"
                 onClick={(e) => {
                   setIsOpen(false);
                   if (location.pathname === '/team') {
                     e.preventDefault();
                     window.scrollTo({ top: 0, behavior: 'smooth' });
                     // Clear any hash from URL
                     window.history.pushState(null, '', '/team');
                   }
                 }}
               >
                 Book Now
               </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
