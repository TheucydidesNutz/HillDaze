// Helper that automatically adds x-trip-id header to all admin API calls

export function getTripIdFromStorage(): string | null {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem('current_trip')
      if (!stored) return null
      return JSON.parse(stored).id
    } catch {
      return null
    }
  }
  
  export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const tripId = getTripIdFromStorage()
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(tripId ? { 'x-trip-id': tripId } : {}),
      },
    })
  }