

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, User, GraduationCap, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { StripeConnectOnboarding } from '@/components/StripeConnectOnboarding';

const signupSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .max(128, 'Password must be less than 128 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  userType: z.enum(['student', 'tutor'], {
    required_error: 'Please select if you are a student or tutor',
  }),
  firstName: z.string().trim().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  university: z.string().optional(),
  degree: z.string().optional(),
  year: z.string().optional(),
  exams: z.array(z.string()).optional(),
  examRates: z.record(z.string(), z.number().min(1, 'Rate must be at least £1').max(200, 'Rate cannot exceed £200')).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.userType === 'tutor') {
    return data.exams && data.exams.length > 0 && 
           data.examRates && Object.keys(data.examRates).length > 0 && 
           data.university && data.degree && data.year;
  }
  return true;
}, {
  message: "Tutors must complete all required fields including exam rates",
  path: ["university"],
});

const universities = [
  'Oxford',
  'Cambridge', 
  'Imperial College London',
  'LSE'
];

const degrees = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Economics',
  'Engineering'
];

const years = [
  '1st',
  '2nd', 
  '3rd'
];

const exams = [
  'TMUA',
  'MAT',
  'ESAT Maths',
  'ESAT Physics',
  'ESAT Chemistry',
  'ESAT Biology',
  'Interview prep'
];

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

const SignupForm = ({ onSwitchToLogin }: SignupFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<'student' | 'tutor' | null>(null);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [examRates, setExamRates] = useState<Record<string, number>>({});
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      userType: undefined,
      firstName: '',
      university: undefined,
      degree: undefined,
      year: undefined,
      exams: [],
      examRates: {},
    },
  });

  const handleSignUp = async (values: z.infer<typeof signupSchema>) => {
    setLoading(true);

    try {
      // Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`
        }
      });

      if (authError) throw authError;

      // Create/update profile immediately after user creation
      if (authData.user) {
        const profileData = {
          id: authData.user.id,
          user_type: values.userType,
          updated_at: new Date().toISOString(),
        };

        // Add user data based on user type
        Object.assign(profileData, {
          name: values.firstName,
        });

        // Add tutor-specific data if it's a tutor signup
        if (values.userType === 'tutor') {
          Object.assign(profileData, {
            university: `University of ${values.university}`,
            degree: values.degree,
            year: `${values.year} Year`,
            subjects: {
              exams: values.exams
            },
            exam_rates: values.examRates,
          });
        }

        // Insert or update the profile
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });

        if (profileError) {
          // Still store in localStorage as backup with security measures
          if (values.userType === 'tutor') {
            const secureData = {
              user_type: values.userType,
              name: values.firstName?.substring(0, 100), // Limit length
              university: `University of ${values.university}`,
              degree: values.degree,
              year: `${values.year} Year`,
              subjects: {
                exams: values.exams?.slice(0, 10) // Limit array size
              },
              exam_rates: values.examRates,
              expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hour expiry
            };
            
            try {
              localStorage.setItem('tempTutorData', JSON.stringify(secureData));
            } catch (error) {
              console.error('Failed to store tutor data securely:', error);
            }
          }
        }
      }

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account before logging in.",
      });
      
      // Don't redirect - let Layout handle showing EmailVerificationRequired
      // The user will see the email verification required screen automatically
    } catch (error) {
      toast({
        title: "Sign up failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserTypeSelect = (type: 'student' | 'tutor') => {
    setSelectedUserType(type);
    form.setValue('userType', type);
    
    if (type === 'student') {
      setSelectedExams([]);
      setExamRates({});
      form.setValue('exams', []);
      form.setValue('examRates', {});
      form.setValue('university', undefined);
      form.setValue('degree', undefined);
      form.setValue('year', undefined);
    }
  };

  const addExam = (exam: string) => {
    if (!selectedExams.includes(exam)) {
      const newExams = [...selectedExams, exam];
      setSelectedExams(newExams);
      form.setValue('exams', newExams);
      
      // Initialize rate for new exam
      const newRates = { ...examRates, [exam]: 25 };
      setExamRates(newRates);
      form.setValue('examRates', newRates);
    }
  };

  const removeExam = (exam: string) => {
    const newExams = selectedExams.filter(e => e !== exam);
    setSelectedExams(newExams);
    form.setValue('exams', newExams);
    
    // Remove rate for removed exam
    const newRates = { ...examRates };
    delete newRates[exam];
    setExamRates(newRates);
    form.setValue('examRates', newRates);
  };

  const updateExamRate = (exam: string, rate: number) => {
    const newRates = { ...examRates };
    
    // If updating an ESAT subject, update all ESAT subjects to the same rate
    if (exam.startsWith('ESAT')) {
      const esatExams = selectedExams.filter(e => e.startsWith('ESAT'));
      esatExams.forEach(esatExam => {
        newRates[esatExam] = rate;
      });
    } else {
      newRates[exam] = rate;
    }
    
    setExamRates(newRates);
    form.setValue('examRates', newRates);
  };

  const calculateTutorEarnings = (hourlyRate: number) => {
    if (!hourlyRate || hourlyRate <= 0) return 0;
    
    // Tutor receives 85% of the rate
    const tutorReceives = hourlyRate * 0.85;
    
    return Math.max(0, tutorReceives);
  };


  return (
    <Card className="bg-background/95 backdrop-blur shadow-elegant">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-primary">
          Create Account
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Join us to start your journey to Oxbridge & Imperial
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSignUp)} className="space-y-4">
            {/* User Type Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={selectedUserType === 'student' ? 'default' : 'outline'}
                  className={`h-20 flex-col gap-2 transition-all border-2 ${
                    selectedUserType === 'student'
                      ? 'bg-primary text-primary-foreground shadow-lg border-primary scale-105' 
                      : 'hover:bg-secondary border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleUserTypeSelect('student')}
                >
                  <User className="h-6 w-6" />
                  <span className="font-medium">Student</span>
                </Button>
                <Button
                  type="button"
                  variant={selectedUserType === 'tutor' ? 'default' : 'outline'}
                  className={`h-20 flex-col gap-2 transition-all border-2 ${
                    selectedUserType === 'tutor'
                      ? 'bg-primary text-primary-foreground shadow-lg border-primary scale-105' 
                      : 'hover:bg-secondary border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleUserTypeSelect('tutor')}
                >
                  <GraduationCap className="h-6 w-6" />
                  <span className="font-medium">Tutor</span>
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      className="bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="bg-background pr-10"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>Password must contain:</p>
                    <ul className="grid grid-cols-2 gap-1 text-xs">
                      <li className={`flex items-center gap-1 ${field.value?.length >= 6 ? 'text-green-600' : ''}`}>
                        {field.value?.length >= 6 ? '✓' : '•'} At least 6 characters
                      </li>
                      <li className={`flex items-center gap-1 ${/[a-z]/.test(field.value || '') ? 'text-green-600' : ''}`}>
                        {/[a-z]/.test(field.value || '') ? '✓' : '•'} Lowercase letter
                      </li>
                      <li className={`flex items-center gap-1 ${/[A-Z]/.test(field.value || '') ? 'text-green-600' : ''}`}>
                        {/[A-Z]/.test(field.value || '') ? '✓' : '•'} Uppercase letter
                      </li>
                      <li className={`flex items-center gap-1 ${/[0-9]/.test(field.value || '') ? 'text-green-600' : ''}`}>
                        {/[0-9]/.test(field.value || '') ? '✓' : '•'} Number
                      </li>
                    </ul>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm your password"
                      className="bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your first name"
                      className="bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tutor-specific fields */}
            {selectedUserType === 'tutor' && (
              <div className="space-y-4 animate-fade-in p-4 bg-secondary/50 rounded-lg border">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <GraduationCap className="h-5 w-5" />
                  <span>Tutor Information</span>
                </div>
                
                {/* Stripe Setup Notice */}
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <div className="font-medium mb-1">Important: Payment Account Setup Required</div>
                    <div className="text-sm">
                      After creating your account, you'll need to set up your Stripe payment account in Profile Settings to receive payments from students.
                    </div>
                  </AlertDescription>
                </Alert>
                
                <FormField
                  control={form.control}
                  name="university"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>University</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select your university" />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          {universities.map((university) => (
                            <SelectItem key={university} value={university}>
                              {university}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="degree"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Degree</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select your degree" />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          {degrees.map((degree) => (
                            <SelectItem key={degree} value={degree}>
                              {degree}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year of Study</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select your year" />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          {years.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-4">
                  <label className="text-sm font-medium">Exams You Can Teach</label>
                  <div className="grid grid-cols-2 gap-3">
                    {exams.map((exam) => {
                      const isSelected = selectedExams.includes(exam);
                      return (
                        <Button
                          key={exam}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className={`h-auto p-4 flex-col gap-2 text-sm transition-all border-2 ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-lg border-primary scale-105' 
                              : 'hover:bg-secondary border-border hover:border-primary/50'
                          }`}
                          onClick={() => isSelected ? removeExam(exam) : addExam(exam)}
                        >
                          <span className="font-medium text-center leading-tight">{exam}</span>
                          {isSelected && (
                            <div className="flex items-center gap-1 text-xs opacity-90">
                              <span>Selected</span>
                              <X className="h-3 w-3" />
                            </div>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  {selectedExams.length > 0 && (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex flex-wrap gap-2">
                        {selectedExams.map((exam) => (
                          <Badge
                            key={exam}
                            variant="secondary"
                            className="text-sm bg-primary/10 text-primary border-primary/20"
                          >
                            {exam}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedExams.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Set Your Rates (£/hour)</label>
                    <div className="space-y-2">
                      {/* Group ESAT subjects together */}
                      {selectedExams.some(exam => exam.startsWith('ESAT')) && (
                        <div className="p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium min-w-[120px]">
                              ESAT (All subjects):
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="25.00"
                              value={examRates[selectedExams.find(e => e.startsWith('ESAT')) || ''] || ''}
                              onChange={(e) => {
                                const firstESAT = selectedExams.find(e => e.startsWith('ESAT'));
                                if (firstESAT) {
                                  updateExamRate(firstESAT, parseFloat(e.target.value) || 0);
                                }
                              }}
                              className="bg-white flex-1"
                            />
                            <span className="text-sm text-muted-foreground">£/hour</span>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Applies to: {selectedExams.filter(e => e.startsWith('ESAT')).join(', ')}
                          </div>
                          {(() => {
                            const esatRate = examRates[selectedExams.find(e => e.startsWith('ESAT')) || ''] || 0;
                            const earnings = calculateTutorEarnings(esatRate);
                            return esatRate > 0 && (
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                                <div className="text-sm text-green-800">
                                  <span className="font-medium">You'll receive: £{earnings.toFixed(2)}/hour</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      
                      {/* Other non-ESAT exams */}
                      {selectedExams.filter(exam => !exam.startsWith('ESAT')).map((exam) => (
                        <div key={exam} className="p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium min-w-[120px]">{exam}:</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="25.00"
                              value={examRates[exam] || ''}
                              onChange={(e) => updateExamRate(exam, parseFloat(e.target.value) || 0)}
                              className="bg-white flex-1"
                            />
                            <span className="text-sm text-muted-foreground">£/hour</span>
                          </div>
                          {(() => {
                            const rate = examRates[exam] || 0;
                            const earnings = calculateTutorEarnings(rate);
                            return rate > 0 && (
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                                <div className="text-sm text-green-800">
                                  <span className="font-medium">You'll receive: £{earnings.toFixed(2)}/hour</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Please wait...' : 'Create Account'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default SignupForm;
