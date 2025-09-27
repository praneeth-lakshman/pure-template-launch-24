

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONNECT-PAYMENT] ${step}${detailsStr}`);
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
    
    // Test API key validity
    try {
      await stripe.balance.retrieve();
      logStep("API key is valid");
    } catch (keyError) {
      logStep("API key test failed", keyError);
      const errorMessage = keyError instanceof Error ? keyError.message : String(keyError);
      throw new Error(`Invalid Stripe API key: ${errorMessage}`);
    }

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

    // Parse request body
    const body = await req.json();
    const { tutorId, examType, lessonQuantity = 1, customAmount } = body;
    
    if (!tutorId || !examType) {
      throw new Error("Missing required parameters: tutorId and examType");
    }

    // Get tutor data and their Stripe Connect account
    const { data: tutorProfile, error: tutorError } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('id', tutorId)
      .single();

    if (tutorError || !tutorProfile) {
      throw new Error("Tutor not found");
    }

    // Require Stripe Connect account for all tutors
    if (!tutorProfile.stripe_account_id || !tutorProfile.charges_enabled) {
      throw new Error("Tutor has not completed their Stripe Connect setup. Please ask the tutor to complete their payment account setup before booking lessons.");
    }

    logStep("Tutor Stripe Connect account verified", { 
      tutorName: tutorProfile.name,
      accountId: tutorProfile.stripe_account_id,
      chargesEnabled: tutorProfile.charges_enabled
    });

    // Get the rate for this exam type - allow custom amount override
    let hourlyRate = 30; // Default rate
    
    if (customAmount && typeof customAmount === 'number' && customAmount > 0) {
      hourlyRate = customAmount;
      logStep("Custom amount provided", { customAmount });
    } else {
      const examRates = tutorProfile.exam_rates || {};
      const examKeyMap: { [key: string]: string } = {
        'tmua': 'TMUA',
        'mat': 'MAT',
        'esat': 'ESAT',
        'interview-prep': 'Interview prep',
        'interview prep': 'Interview prep' // Handle both formats
      };

      const rateKey = examKeyMap[examType] || examType.toUpperCase();
      if (examRates[rateKey]) {
        hourlyRate = examRates[rateKey];
      }
    }

    // Apply 15% discount for 5-lesson packs or more
    let totalLessonPrice = hourlyRate * lessonQuantity;
    let discountApplied = false;
    
    if (lessonQuantity >= 5) {
      totalLessonPrice = Math.round(hourlyRate * lessonQuantity * 0.85); // 15% discount
      discountApplied = true;
      logStep("Bulk discount applied", { originalPrice: hourlyRate * lessonQuantity, discountedPrice: totalLessonPrice });
    }

    const platformFeePercent = 0.15; // 15% platform fee
    const tutorAmount = Math.round(totalLessonPrice * 100 * (1 - platformFeePercent));
    const platformFee = Math.round(totalLessonPrice * 100 * platformFeePercent);
    const totalAmount = tutorAmount + platformFee;

    logStep("Payment calculation", { 
      hourlyRate, 
      lessonQuantity,
      totalLessonPrice,
      discountApplied,
      tutorAmount, 
      platformFee, 
      totalAmount 
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create Stripe Connect checkout session (required for all payments)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${examType.toUpperCase()} Tutoring with ${tutorProfile.name}`,
              description: `${lessonQuantity} lesson${lessonQuantity > 1 ? 's' : ''} - £${hourlyRate}/hour${discountApplied ? ' (15% bulk discount applied)' : ''}`,
            },
            unit_amount: totalLessonPrice * 100, // Total price in pence
          },
          quantity: 1, // Always 1 since we're selling the complete package
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/team#${examType}`,
      
      // STRIPE CONNECT CONFIGURATION (15% platform fee)
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: tutorProfile.stripe_account_id,
        },
        metadata: {
          tutorId,
          examType,
          lessonQuantity: lessonQuantity.toString(),
          platform_fee: platformFee.toString(),
        },
      },
      
      metadata: {
        tutorId,
        examType,
        lessonQuantity: lessonQuantity.toString(),
        connected_account_id: tutorProfile.stripe_account_id,
      },
    });

    logStep("Stripe Connect checkout session created", { 
      sessionId: session.id,
      platformFee: platformFee,
      tutorAmount: tutorAmount 
    });

    // Store payment record
    const { error: paymentError } = await supabaseService
      .from('payments')
      .insert({
        student_id: user.id,
        tutor_id: tutorId,
        stripe_session_id: session.id,
        connected_account_id: tutorProfile.stripe_account_id || null,
        amount: totalAmount,
        platform_fee: platformFee,
        tutor_amount: tutorAmount,
        currency: 'gbp',
        exam_type: examType,
        lesson_quantity: lessonQuantity,
        status: 'pending'
      });

    if (paymentError) {
      throw new Error(`Failed to create payment record: ${paymentError.message}`);
    }

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-connect-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
