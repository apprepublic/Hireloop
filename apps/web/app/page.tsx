'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  const router = useRouter()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      router.push('/feed')
    }
  }, [user, router])

  if (user) return null

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl font-bold tracking-tight mb-4">
        HireLoop
      </h1>
      <p className="text-lg text-muted-foreground max-w-md mb-8">
        AI-powered job search, CV optimization, and auto-apply. Find your next role faster.
      </p>
      <div className="flex gap-4">
        <Link href="/register">
          <Button size="lg">Get started</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="lg">Sign in</Button>
        </Link>
      </div>
    </main>
  )
}
