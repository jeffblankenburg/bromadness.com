'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function VerifyPage() {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState('')
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const storedPhone = sessionStorage.getItem('pendingPhone')
    if (!storedPhone) {
      router.push('/login')
      return
    }
    setPhone(storedPhone)
    inputRefs.current[0]?.focus()
  }, [router])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    setError('')

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when complete
    if (value && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleVerify(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const newCode = pasted.split('')
      setCode(newCode)
      handleVerify(pasted)
    }
  }

  const handleVerify = async (verificationCode: string) => {
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: verificationCode,
        type: 'sms',
      })

      if (error) {
        setError(error.message)
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
        setLoading(false)
        return
      }

      // Success - redirect to home
      sessionStorage.removeItem('pendingPhone')
      router.push('/')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      })

      if (error) {
        setError(error.message)
      } else {
        setError('')
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch {
      setError('Failed to resend code')
    }

    setResending(false)
  }

  const formatPhoneDisplay = (p: string) => {
    const numbers = p.replace(/\D/g, '').slice(-10)
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-4">
            <Image
              src="/logo.png"
              alt="Bro Madness"
              width={200}
              height={133}
              priority
              className="mx-auto"
            />
            <h1 className="text-2xl font-bold">Enter verification code</h1>
            <p className="text-zinc-400">
              We sent a code to {phone && formatPhoneDisplay(phone)}
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className="w-12 h-14 text-center text-2xl font-bold bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
                />
              ))}
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            {loading && (
              <p className="text-orange-400 text-sm text-center uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Verifying...</p>
            )}
          </div>

          <div className="text-center space-y-4">
            <button
              onClick={handleResend}
              disabled={resending || loading}
              className="text-orange-400 hover:text-orange-300 disabled:text-zinc-600 text-sm font-medium"
            >
              {resending ? 'Sending...' : "Didn't receive the code? Resend"}
            </button>

            <button
              onClick={() => {
                sessionStorage.removeItem('pendingPhone')
                router.push('/login')
              }}
              className="block w-full text-zinc-500 hover:text-zinc-400 text-sm"
            >
              Use a different phone number
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
