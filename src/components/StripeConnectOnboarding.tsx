

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StripeConnectOnboardingProps {
  onComplete?: () => void;
}

export const StripeConnectOnboarding = ({ onComplete }: StripeConnectOnboardingProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStartOnboarding = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to continue",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Check if the response contains an error (even with 200 status)
      if (data?.error) {
        const errorObj = new Error(data.message || data.error);
        errorObj.message = data.error; // Set the error code for specific handling
        throw errorObj;
      }

      if (data.existing) {
        toast({
          title: "Account Found",
          description: "You already have a Stripe Connect account set up.",
        });
        onComplete?.();
      } else if (data.onboardingUrl) {
        // Open Stripe onboarding in new tab
        window.open(data.onboardingUrl, '_blank');
        toast({
          title: "Onboarding Started",
          description: "Complete the setup in the new tab, then return here to refresh your status.",
        });
      }
    } catch (error: any) {
      console.error('Error starting onboarding:', error);
      
      // Handle specific Stripe Connect not enabled error
      if (error.message?.includes("STRIPE_CONNECT_NOT_ENABLED")) {
        toast({
          title: "Stripe Connect Required",
          description: (
            <div className="space-y-2">
              <p>You need to enable Stripe Connect in your Stripe Dashboard first.</p>
              <a 
                href="https://dashboard.stripe.com/connect/accounts/overview" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                Enable Stripe Connect →
              </a>
            </div>
          ),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to start Stripe Connect onboarding",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-card border-0 shadow-elegant">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Set Up Payments</CardTitle>
        <CardDescription>
          Connect your Stripe account to start receiving payments from students
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            You'll need to complete Stripe's verification process with the same sign-up email to receive payments. This typically takes a few minutes and requires basic business information. After sign-up is completed, the system will automatically find and connect to your existing Stripe account.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-medium text-foreground">What you'll need:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Personal identification (passport or driving licence)</li>
            <li>• Bank account details for payouts</li>
            <li>• Phone number for verification</li>
            <li>• National Insurance (NI) number</li>
          </ul>
        </div>

        <Button 
          onClick={handleStartOnboarding}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              Start Stripe Setup
            </>
          )}
        </Button>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800">
            <div className="space-y-2">
              <p className="font-medium">Need help getting started?</p>
              <p>Please follow the instructions in the link below to start onboarding:</p>
              <a 
                href="https://docs.google.com/document/d/1GpQpPj9kAivE8lhD140WzqnbahBio-amJYz0ALm-bmw/edit?usp=sharing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:no-underline inline-flex items-center gap-1"
              >
                Onboarding Instructions
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </AlertDescription>
        </Alert>

        <p className="text-xs text-muted-foreground text-center">
          By continuing, you agree to Stripe's terms of service. 
          Your information is securely processed by Stripe.
        </p>
      </CardContent>
    </Card>
  );
};
