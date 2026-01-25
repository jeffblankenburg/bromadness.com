import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Check if this phone number exists in our users table
    const { data: existingUser, error: lookupError } = await adminClient
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single()

    if (lookupError || !existingUser) {
      // Don't reveal whether the phone exists or not for security
      // But do NOT send an OTP
      return NextResponse.json({ error: 'Unable to send verification code. Please contact an administrator.' }, { status: 403 })
    }

    // User exists, now send the OTP
    const { error: otpError } = await adminClient.auth.signInWithOtp({
      phone,
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
