import { Trip } from './types'

export function getCurrentTrip(): Trip | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('current_trip')
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

export function setCurrentTrip(trip: Trip) {
  localStorage.setItem('current_trip', JSON.stringify(trip))
}

export function clearCurrentTrip() {
  localStorage.removeItem('current_trip')
}