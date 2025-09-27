
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-MOCK-PAPERS] ${step}${detailsStr}`);
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
    const { examType, paperType, setName } = body;
    
    if (!examType || !paperType || !setName) {
      throw new Error("Missing required parameters: examType, paperType, and setName");
    }

    // Define pricing
    const pricing = {
      single: 2900, // £29.00 in pence
      complete: 5000, // £50.00 in pence
    };

    const amount = pricing[paperType as keyof typeof pricing];
    if (!amount) {
      throw new Error("Invalid paper type. Must be 'single' or 'complete'");
    }

    logStep("Payment calculation", { 
      examType, 
      paperType,
      setName,
      amount 
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create product name and description
    const productName = paperType === 'complete' 
      ? `${examType.toUpperCase()} Mock ${setName} - Complete Set`
      : `${examType.toUpperCase()} Mock ${setName} - Single Paper`;
    
    const description = paperType === 'complete'
      ? `Complete mock paper set including both papers and detailed solutions`
      : `Single mock paper with detailed solutions`;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: productName,
              description: description,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/${examType}/mock-papers`,
      
      metadata: {
        type: 'mock_papers',
        examType,
        paperType,
        setName,
        userId: user.id,
      },
    });

    logStep("Stripe checkout session created", { 
      sessionId: session.id,
      amount: amount 
    });

    // Store payment record
    const { error: paymentError } = await supabaseService
      .from('payments')
      .insert({
        student_id: user.id,
        tutor_id: 'mock_papers', // Special identifier for mock paper purchases
        stripe_session_id: session.id,
        amount: amount,
        platform_fee: 0, // No platform fee for mock papers
        tutor_amount: 0, // No tutor amount for mock papers
        currency: 'gbp',
        exam_type: examType,
        lesson_quantity: 1,
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
    logStep("ERROR in purchase-mock-papers", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
