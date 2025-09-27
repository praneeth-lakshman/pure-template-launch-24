import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { GraduationCap, MapPin, Clock, ArrowUp, Mail, MessageSquare, RotateCcw, ChevronDown } from 'lucide-react';
import { TutorPricingDisplay } from '@/components/TutorPricingDisplay';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TutorFilters, FilterState } from '@/components/TutorFilters';

const Team = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [filteredTutors, setFilteredTutors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeStatuses, setStripeStatuses] = useState<{[tutorId: string]: boolean}>({});
  const [filters, setFilters] = useState<FilterState>({
    entranceExam: 'all',
    subject: 'all',
    priceRange: [0, 100] // Default to full range instead of pre-selecting 20-50
  });

  // Initialize filters after loading tutors
  useEffect(() => {
    if (teamMembers.length > 0) {
      const initialPriceRange = getPriceRange();
      setFilters(prev => ({ ...prev, priceRange: initialPriceRange }));
    }
  }, [teamMembers]);

  // Load tutors from database
  useEffect(() => {
    const loadTutors = async () => {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*, stripe_account_id, charges_enabled, payouts_enabled')
          .eq('user_type', 'tutor');

        if (error) {
          return;
        }

        // Set default rates for specific tutors
        const setDefaultRates = async () => {
          const updates = [];
          
          // Find Pranav and set his rates to £25
          const pranavsProfile = profiles?.find(p => p.name?.toLowerCase().includes('pranav'));
          if (pranavsProfile && (!pranavsProfile.exam_rates || Object.keys(pranavsProfile.exam_rates || {}).length === 0)) {
            updates.push(
              supabase
                .from('profiles')
                .update({
                  exam_rates: {
                    'TMUA': 25,
                    'MAT': 25,
                    'ESAT': 25,
                    'Interview prep': 25
                  }
                })
                .eq('id', pranavsProfile.id)
            );
          }
          
          // Find Vincent and set his rates to £35
          const vincentsProfile = profiles?.find(p => p.name?.toLowerCase().includes('vincent'));
          if (vincentsProfile && (!vincentsProfile.exam_rates || Object.keys(vincentsProfile.exam_rates || {}).length === 0)) {
            updates.push(
              supabase
                .from('profiles')
                .update({
                  exam_rates: {
                    'TMUA': 35,
                    'MAT': 35,
                    'ESAT': 35,
                    'Interview prep': 35
                  }
                })
                .eq('id', vincentsProfile.id)
            );
          }
          
          if (updates.length > 0) {
            await Promise.all(updates);
            // Reload profiles after updating rates
            const { data: updatedProfiles } = await supabase
              .from('profiles')
              .select('*, stripe_account_id, charges_enabled, payouts_enabled')
              .eq('user_type', 'tutor');
            return updatedProfiles;
          }
          
          return profiles;
        };

        const finalProfiles = await setDefaultRates();

        // Transform database data to match component format
        // IMPORTANT: Maintain exact profile structure for consistency
        // Profile format: Avatar, Name, Description, University, Lesson Rates, 2 Buttons
        const transformedTutors = finalProfiles?.map(profile => {
          let specialties: string[] = [];
          
          // Handle subjects data structure safely
          if (profile.subjects && typeof profile.subjects === 'object' && !Array.isArray(profile.subjects)) {
            const subjectsObj = profile.subjects as { [key: string]: any };
            if (subjectsObj.exams && Array.isArray(subjectsObj.exams)) {
              specialties = subjectsObj.exams;
            }
          } else if (Array.isArray(profile.subjects)) {
            specialties = profile.subjects as string[];
          }

          return {
            id: profile.id,
            name: profile.name || 'Anonymous Tutor',
            role: "Tutor",
            university: profile.university || 'University',
            course: profile.degree || 'Course',
            year: profile.year || 'Year',
            specialties,
            examRates: profile.exam_rates || {},
            account_status: (profile as any).account_status || 'active',
            stripe_account_id: profile.stripe_account_id,
            charges_enabled: profile.charges_enabled,
            payouts_enabled: profile.payouts_enabled
          };
        }) || [];

        setTeamMembers(transformedTutors);
        setFilteredTutors(transformedTutors);
      } catch (error) {
        console.error('Error loading tutors:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTutors();
  }, []);

  // Check Stripe Connect status for each tutor
  useEffect(() => {
    const checkStripeStatuses = async () => {
      if (teamMembers.length === 0) return;
      
      const statusPromises = teamMembers.map(async (tutor) => {
        try {
          // Comprehensive check for fully connected Stripe account
          const hasStripeAccountId = Boolean(tutor.stripe_account_id);
          const canAcceptCharges = Boolean(tutor.charges_enabled);
          const canReceivePayouts = Boolean(tutor.payouts_enabled);
          
          // Only mark as fully setup if ALL conditions are met
          const isFullyConnected = hasStripeAccountId && canAcceptCharges && canReceivePayouts;
          
          console.log(`Stripe status for ${tutor.name}:`, {
            hasStripeAccountId,
            canAcceptCharges,
            canReceivePayouts,
            isFullyConnected,
            accountId: tutor.stripe_account_id
          });
          
          return { tutorId: tutor.id, hasStripeSetup: isFullyConnected };
        } catch (error) {
          console.error(`Error checking Stripe status for tutor ${tutor.id}:`, error);
          return { tutorId: tutor.id, hasStripeSetup: false };
        }
      });

      const results = await Promise.all(statusPromises);
      const statusMap = results.reduce((acc, { tutorId, hasStripeSetup }) => {
        acc[tutorId] = hasStripeSetup;
        return acc;
      }, {} as {[tutorId: string]: boolean});

      setStripeStatuses(statusMap);
    };

    checkStripeStatuses();
  }, [teamMembers]);

  const examSections = [
    { 
      id: "tmua", 
      title: "TMUA Tutors", 
      description: ""
    },
    { 
      id: "mat", 
      title: "MAT Tutors", 
      description: ""
    },
    { 
      id: "esat", 
      title: "ESAT Tutors", 
      description: ""
    },
    { 
      id: "interview-prep", 
      title: "Interview Preparation", 
      description: ""
    }
  ];

  useEffect(() => {
    const scrollToSection = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        // Small delay to ensure the element is rendered
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    };

    // Scroll on initial load
    scrollToSection();

    // Listen for hash changes
    const handleHashChange = () => {
      scrollToSection();
    };

    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getTutorsForExam = (examType: string) => {
    return filteredTutors.filter(member => 
      member.specialties.some(specialty => {
        const normalizedSpecialty = specialty.toLowerCase();
        const normalizedExamType = examType.toLowerCase();
        
        if (examType === "interview-prep") {
          return normalizedSpecialty.includes("interview");
        }
        
        // Exact match for MAT to avoid matching "Maths"
        if (normalizedExamType === "mat") {
          return normalizedSpecialty === "mat";
        }
        
        return normalizedSpecialty.includes(normalizedExamType);
      })
    );
  };

  // Filter logic
  const applyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    
    let filtered = teamMembers.filter(member => {
      // Filter by entrance exam
      if (newFilters.entranceExam && newFilters.entranceExam !== 'all') {
        const hasExam = member.specialties.some(specialty => {
          const normalizedSpecialty = specialty.toLowerCase();
          const normalizedExam = newFilters.entranceExam.toLowerCase();
          
          if (normalizedExam === "interview-prep") {
            return normalizedSpecialty.includes("interview");
          }
          
          if (normalizedExam === "mat") {
            return normalizedSpecialty === "mat";
          }
          
          return normalizedSpecialty.includes(normalizedExam);
        });
        if (!hasExam) return false;
      }
      
      // Filter by degree
      if (newFilters.subject && newFilters.subject !== 'all') {
        const hasDegree = member.course && 
          member.course.toLowerCase().includes(newFilters.subject.toLowerCase());
        if (!hasDegree) return false;
      }
      
      // Filter by price range
      const memberRates = Object.values(member.examRates || {}) as number[];
      
      if (memberRates.length > 0) {
        // Check if any rate falls within the price range
        const hasRateInRange = memberRates.some(rate => 
          rate >= newFilters.priceRange[0] && rate <= newFilters.priceRange[1]
        );
        if (!hasRateInRange) return false;
      } else {
        // Use default rate if no rates specified
        const defaultRate = 30;
        if (defaultRate < newFilters.priceRange[0] || defaultRate > newFilters.priceRange[1]) {
          return false;
        }
      }
      
      return true;
    });
    
    setFilteredTutors(filtered);
  };

  // Get unique values for filter options
  const getAvailableExams = () => {
    const exams = new Set<string>();
    teamMembers.forEach(member => {
      member.specialties.forEach(specialty => {
        const normalized = specialty.toLowerCase();
        if (normalized.includes('tmua')) exams.add('tmua');
        if (normalized === 'mat') exams.add('mat');
        if (normalized.includes('esat')) exams.add('esat');
        if (normalized.includes('interview')) exams.add('interview-prep');
      });
    });
    return Array.from(exams);
  };

  const getAvailableSubjects = () => {
    // Return the standardized subject list
    return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Engineering'];
  };

  const getPriceRange = (): [number, number] => {
    const allRates: number[] = [];
    teamMembers.forEach(member => {
      const rates = Object.values(member.examRates || {}) as number[];
      if (rates.length > 0) {
        allRates.push(...rates);
      } else {
        allRates.push(30); // default rate
      }
    });
    
    if (allRates.length === 0) return [0, 100];
    
    const min = Math.min(...allRates);
    const max = Math.max(...allRates);
    const range = [Math.floor(min / 5) * 5, Math.ceil(max / 5) * 5] as [number, number];
    return range; // Round to nearest 5
  };

  const getEmailTitle = (sectionId: string) => {
    switch (sectionId) {
      case "tmua": return "TMUA";
      case "mat": return "MAT";
      case "esat": return "ESAT + options";
      case "interview-prep": return "Interview preparation";
      default: return sectionId.toUpperCase();
    }
  };

  // Normalize exam type for payment API consistency
  const normalizeExamTypeForPayment = (specialty: string): string => {
    const normalized = specialty.toLowerCase().trim();
    
    // Map various formats to consistent payment API format
    const examTypeMap: { [key: string]: string } = {
      'interview prep': 'interview-prep',
      'interview preparation': 'interview-prep',
      'tmua': 'tmua',
      'mat': 'mat',
      'esat': 'esat'
    };
    
    return examTypeMap[normalized] || normalized.replace(/\s+/g, '-');
  };

  const getExamSpecificRate = (member: any, sectionId: string) => {
    const rates = member.examRates || {};
    
    // Map section IDs to the exam keys used in signup
    const examKeyMap = {
      'tmua': 'TMUA',
      'mat': 'MAT', 
      'esat': 'ESAT',
      'interview-prep': 'Interview prep'
    };
    
    const examKey = examKeyMap[sectionId as keyof typeof examKeyMap] || sectionId.toUpperCase();
    const rate = rates[examKey] || rates[sectionId] || 30;
    return `£${rate}/hour`;
  };

  // Standard Tutor Profile Template - DO NOT MODIFY
  // Each profile must contain exactly:
  // 1. Avatar (graduation cap icon)
  // 2. Name
  // 3. Description (year + course + student)
  // 4. University (with map pin icon)
  // 5. Lesson rates in the pricing box
  // 6. Two buttons (Chat Now and Buy Lessons/Setup In Progress)
  const renderTutorCard = (member: any, tutorIndex: number, sectionId: string) => {
    const examRate = getExamSpecificRate(member, sectionId);

    return (
      <Card key={`${member.name}-card`} className="hover:shadow-elegant transition-all duration-300 h-full flex flex-col hover:scale-[1.02]">
        <CardContent className="p-6 flex-1 flex flex-col">
          <div className="flex gap-6 mb-4 flex-1">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 bg-gradient-hero rounded-full flex items-center justify-center">
                <GraduationCap className="h-10 w-10 text-white" />
              </div>
            </div>
            
            {/* Details Section - Single Column */}
            <div className="flex-1">
              {/* Name, University Column */}
              <div>
                <CardTitle className="text-lg mb-2">{member.name}</CardTitle>
                <CardDescription className="font-medium text-primary mb-2">
                  {member.year} {member.course} Student
                </CardDescription>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="text-sm">{member.university}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Pricing Section */}
          <div className="mb-4">
            <TutorPricingDisplay 
              examRates={member.examRates || {}}
              highlightedExam={sectionId}
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            {member.account_status === 'paused' ? (
              <Button 
                disabled
                className="flex-1 opacity-50 cursor-not-allowed"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat Unavailable
              </Button>
            ) : (
              <Button 
                asChild
                className="flex-1 text-white hover:text-white hover:scale-105 transition-transform duration-200"
                style={{ color: 'white' }}
              >
                <Link 
                  to={`/chat/${member.id}`}
                  className="text-white hover:text-white no-underline flex items-center"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat Now
                </Link>
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  className={`flex-1 transition-transform duration-200 ${
                    stripeStatuses[member.id] 
                      ? 'text-white hover:text-white hover:scale-105' 
                      : 'text-muted-foreground bg-muted cursor-not-allowed opacity-60'
                  }`}
                  style={stripeStatuses[member.id] ? { color: 'white' } : {}}
                  disabled={!stripeStatuses[member.id]}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  {stripeStatuses[member.id] ? 'Buy Lessons' : 'Setup In Progress'}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Choose Lesson Package</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {member.specialties.map((specialty: string) => {
                  const examKey = specialty;
                  const hourlyRate = member.examRates?.[examKey] || member.examRates?.[specialty.toUpperCase()] || 30;
                  const singlePrice = hourlyRate;
                  const fivePackPrice = Math.round(hourlyRate * 5 * 0.85); // 15% discount
                  const savings = (hourlyRate * 5) - fivePackPrice;
                  
                  return (
                    <div key={specialty}>
                      <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">
                        {specialty}
                      </DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={async () => {
                          try {
                            const { data: { user }, error: authError } = await supabase.auth.getUser();
                            
                            if (authError || !user) {
                              window.location.href = '/login';
                              return;
                            }
                            
                            const { data, error } = await supabase.functions.invoke('create-payment', {
                              body: {
                                tutorId: member.id,
                                examType: normalizeExamTypeForPayment(specialty),
                                lessonQuantity: 1
                              }
                            });

                            if (error) {
                              alert(`Payment failed: ${error.message}`);
                              return;
                            }

                            if (data?.url) {
                              window.open(data.url, '_blank');
                            } else {
                              alert('Failed to create payment session. Please try again.');
                            }
                          } catch (error) {
                            alert('Something went wrong. Please try again.');
                          }
                        }}
                        className="px-2 py-2 cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">Single Lesson</span>
                          <span className="text-sm text-muted-foreground">£{singlePrice}/hour</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          try {
                            const { data: { user }, error: authError } = await supabase.auth.getUser();
                            
                            if (authError || !user) {
                              window.location.href = '/login';
                              return;
                            }
                            
                            const { data, error } = await supabase.functions.invoke('create-payment', {
                              body: {
                                tutorId: member.id,
                                examType: normalizeExamTypeForPayment(specialty),
                                lessonQuantity: 5
                              }
                            });

                            if (error) {
                              alert(`Payment failed: ${error.message}`);
                              return;
                            }

                            if (data?.url) {
                              window.open(data.url, '_blank');
                            } else {
                              alert('Failed to create payment session. Please try again.');
                            }
                          } catch (error) {
                            alert('Something went wrong. Please try again.');
                          }
                        }}
                        className="px-2 py-2 cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">5 Lesson Pack</span>
                            <Badge variant="destructive" className="text-xs">15% OFF</Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <span className="line-through">£{hourlyRate * 5}</span>
                            <span className="font-medium text-foreground">£{fivePackPrice}</span>
                          </div>
                        </div>
                      </DropdownMenuItem>
                      {member.specialties.indexOf(specialty) < member.specialties.length - 1 && (
                        <DropdownMenuSeparator />
                      )}
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Meet Our Expert Tutors
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our tutors are current students at the top UK universities who have successfully navigated 
            the admissions process and are passionate about helping you achieve your goals.
          </p>
        </div>

        {/* Filter Component */}
        <TutorFilters
          onFiltersChange={applyFilters}
          availableExams={getAvailableExams()}
          availableSubjects={getAvailableSubjects()}
          priceRange={getPriceRange()}
        />

        {/* Promotional Section */}
        <div className="mb-12">
          <Card className="bg-gradient-hero border-0 shadow-elegant hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-8 text-center">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    🎁 Free Taster Session
                  </h3>
                  <p className="text-white/90">
                    Every lesson comes with a complimentary taster session to ensure the perfect fit!
                  </p>
                </div>
                <div className="w-px h-16 bg-white/30 hidden md:block"></div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    💰 15% Off Bulk Deal
                  </h3>
                  <p className="text-white/90">
                    Save 15% when you purchase a batch of 5 lessons - maximize your learning potential!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Display All Filtered Tutors */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {(filters.entranceExam !== 'all' || filters.subject !== 'all' || 
                filters.priceRange[0] !== getPriceRange()[0] || 
                filters.priceRange[1] !== getPriceRange()[1]) ? 'Filtered Results' : 'All Available Tutors'}
            </h2>
            <p className="text-muted-foreground">
              {filteredTutors.length} {filteredTutors.length === 1 ? 'tutor' : 'tutors'} found
            </p>
          </div>
          
          {filteredTutors.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {filteredTutors.map((member, tutorIndex) => {
                // Find the best exam section for this tutor
                const tutorSections = examSections.filter(section => 
                  getTutorsForExam(section.id).some(t => t.id === member.id)
                );
                const primarySection = tutorSections[0]?.id || 'general';
                
                return renderTutorCard(member, tutorIndex, primarySection);
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-4">
                No tutors match your current filters
              </p>
              <Button variant="outline" onClick={() => {
                setFilters({
                  entranceExam: 'all',
                  subject: 'all',
                  priceRange: getPriceRange()
                });
                applyFilters({
                  entranceExam: 'all',
                  subject: 'all',
                  priceRange: getPriceRange()
                });
              }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          )}
        </div>

        <div className="mt-16 text-center">
          <Card className="bg-gradient-card border-0 shadow-elegant hover:shadow-2xl transition-all duration-300 hover:scale-[1.01]">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Why Choose Our Tutors?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div>
                  <h4 className="font-semibold text-primary mb-2">Recent Experience</h4>
                  <p className="text-muted-foreground text-sm">
                    Our tutors recently went through the same admissions process you're facing, 
                    giving them fresh insights into what examiners are looking for.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">Proven Success</h4>
                  <p className="text-muted-foreground text-sm">
                    All our tutors achieved top grades and gained admission to their first-choice universities, 
                    demonstrating their mastery of the material.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">Personalized Approach</h4>
                  <p className="text-muted-foreground text-sm">
                    We understand that every student is different and tailor our teaching methods 
                    to match your learning style and goals.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-primary rounded-full shadow-elegant hover:shadow-lg transition-all duration-300 hover:scale-125 flex items-center justify-center"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5 text-accent" />
        </button>
      )}
    </div>
  );
};

export default Team;
