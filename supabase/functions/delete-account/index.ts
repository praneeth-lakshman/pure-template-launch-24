

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from "https://esm.sh/stripe@14.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    console.log(`🗑️ Starting account deletion for user: ${user.id}`)

    // Initialize Stripe if needed for Stripe Connect account cleanup
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
    let stripe: Stripe | null = null
    if (stripeKey) {
      stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" })
    }

    // Start a transaction-like sequence to delete all user data
    const userId = user.id

    // 0. Get user profile to check for Stripe Connect account
    console.log('🗑️ Getting user profile for Stripe cleanup...')
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, user_type')
      .eq('id', userId)
      .single()

    // Clean up Stripe Connect account if it exists
    if (stripe && userProfile?.stripe_account_id && userProfile.user_type === 'tutor') {
      try {
        console.log(`🗑️ Deleting Stripe Connect account: ${userProfile.stripe_account_id}`)
        await stripe.accounts.del(userProfile.stripe_account_id)
        console.log('✅ Stripe Connect account deleted successfully')
      } catch (stripeError) {
        console.error('⚠️ Warning: Could not delete Stripe Connect account:', stripeError)
        // Continue with account deletion even if Stripe cleanup fails
      }
    }

    // 1. Delete all messages where user is involved in conversations
    console.log('🗑️ Deleting messages...')
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .or(`client_id.eq.${userId},tutor_id.eq.${userId}`)

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id)
      const { error: messagesError } = await supabaseAdmin
        .from('messages')
        .delete()
        .in('conversation_id', conversationIds)

      if (messagesError) {
        console.error('Error deleting messages:', messagesError)
      }
    }

    // 2. Delete all conversations where user is involved
    console.log('🗑️ Deleting conversations...')
    const { error: conversationsError } = await supabaseAdmin
      .from('conversations')
      .delete()
      .or(`client_id.eq.${userId},tutor_id.eq.${userId}`)

    if (conversationsError) {
      console.error('Error deleting conversations:', conversationsError)
    }

    // 3. Delete all payments where user is involved
    console.log('🗑️ Deleting payments...')
    const { error: paymentsError } = await supabaseAdmin
      .from('payments')
      .delete()
      .or(`student_id.eq.${userId},tutor_id.eq.${userId}`)

    if (paymentsError) {
      console.error('Error deleting payments:', paymentsError)
    }

    // 4. Delete user profile
    console.log('🗑️ Deleting profile...')
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
    }

    // 5. Finally, delete the auth user
    console.log('🗑️ Deleting auth user...')
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError)
      throw new Error('Failed to delete user account')
    }

    console.log(`✅ Successfully deleted account for user: ${userId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account successfully deleted' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Account deletion error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to delete account' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
