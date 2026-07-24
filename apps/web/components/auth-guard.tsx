'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

const publicPaths = ['/login', '/register']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading, initialized } = useAuthStore()

  useEffect(() => {
    if (!initialized || isLoading) return
    if (!user && !publicPaths.includes(pathname)) {
      router.push('/login')
    }
  }, [user, isLoading, initialized, pathname, router])

  if (!initialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user && !publicPaths.includes(pathname)) {
    return null
  }

  return <>{children}</>
}
