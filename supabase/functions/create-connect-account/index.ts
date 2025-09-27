

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONNECT-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY is not set");
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Create Supabase client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseService.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get user profile
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("User profile not found");
    }

    // Check if user already has a Stripe Connect account
    if (profile.stripe_account_id) {
      logStep("User already has Stripe Connect account", { accountId: profile.stripe_account_id });
      
      // Check account status
      const account = await stripe.accounts.retrieve(profile.stripe_account_id);
      
      // If account is fully enabled, return existing status
      if (account.charges_enabled && account.payouts_enabled) {
        return new Response(JSON.stringify({ 
          accountId: profile.stripe_account_id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          existing: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      // Account exists but setup is incomplete - create new onboarding link
      logStep("Account setup incomplete, creating new onboarding link", { 
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled 
      });
      
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripe_account_id,
        refresh_url: `${req.headers.get("origin")}/profile`,
        return_url: `${req.headers.get("origin")}/profile`,
        type: 'account_onboarding',
      });

      logStep("New account link created for existing account", { url: accountLink.url });

      return new Response(JSON.stringify({ 
        accountId: profile.stripe_account_id,
        onboardingUrl: accountLink.url,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        existing: true,
        setupIncomplete: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create new Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'standard',
      country: 'GB',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        user_id: user.id,
        user_type: 'tutor',
        name: profile.name || '',
        university: profile.university || '',
      },
    });

    logStep("Stripe Connect account created", { accountId: account.id });

    // Update profile with Stripe account ID
    const { error: updateError } = await supabaseService
      .from('profiles')
      .update({
        stripe_account_id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      logStep("ERROR updating profile", updateError);
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.headers.get("origin")}/profile`,
      return_url: `${req.headers.get("origin")}/profile`,
      type: 'account_onboarding',
    });

    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      accountId: account.id,
      onboardingUrl: accountLink.url,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      existing: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-connect-account", { message: errorMessage, error });
    
    // Handle specific Stripe Connect not enabled error
    if (error?.raw?.message?.includes("signed up for Connect")) {
      return new Response(JSON.stringify({ 
        error: "STRIPE_CONNECT_NOT_ENABLED",
        message: "Stripe Connect is not enabled for this account. Please enable Stripe Connect in your Stripe Dashboard under Connect > Settings.",
        setupUrl: "https://dashboard.stripe.com/connect/accounts/overview"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
