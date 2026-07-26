import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
const posthogKey = import.meta.env.VITE_POSTHOG_KEY

export function initializeObservability() {
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE, tracesSampleRate: 0.15 })
  }
  if (posthogKey) {
    posthog.init(posthogKey, { api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com', capture_pageview: false, capture_pageleave: true })
  }
}

export function track(event: string, properties: Record<string, string | number | boolean> = {}) {
  if (posthogKey) posthog.capture(event, properties)
  if (import.meta.env.DEV) console.info('[analytics]', event, properties)
}
