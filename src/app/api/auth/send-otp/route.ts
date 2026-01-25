import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Normalize to 10 digits for lookup
    const phone10 = phone.replace(/\D/g, '').slice(-10)

    // Check if this phone number exists in our users table
    const { data: existingUser, error: lookupError } = await adminClient
      .from('users')
      .select('id')
      .eq('phone', phone10)
      .single()

    if (lookupError || !existingUser) {
      console.log('Login attempt blocked - phone not found:', phone10)
      return NextResponse.json({ error: 'Unable to send verification code. Please contact an administrator.' }, { status: 403 })
    }

    // User exists, now send the OTP
    // signInWithOtp needs + prefix, but Supabase normalizes for lookup
    const e164Phone = `+1${phone10}`
    console.log('Sending OTP to:', e164Phone)

    const { error: otpError } = await adminClient.auth.signInWithOtp({
      phone: e164Phone,
    })

    if (otpError) {
      console.error('OTP error:', otpError)
      return NextResponse.json({ error: otpError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}
