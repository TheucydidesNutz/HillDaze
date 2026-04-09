export interface Group {
  id: string
  name: string
  lead_name: string | null
  lead_phone: string | null
  lead_email: string | null
  lead_photo_url: string | null
  trip_id: string
  created_at: string
}

export interface Participant {
  id: string
  access_token: string
  name: string
  company: string | null
  title: string | null
  photo_url: string | null
  phone: string | null
  email: string | null
  emergency_name: string | null
  emergency_phone: string | null
  emergency_email: string | null
  arrival_airline: string | null
  arrival_flight_no: string | null
  arrival_datetime: string | null
  arrival_airport: string | null
  departure_airline: string | null
  departure_flight_no: string | null
  departure_datetime: string | null
  departure_airport: string | null
  hotel_name: string | null
  hotel_room: string | null
  fun_diversions: string | null
  group_id: string | null
  trip_id: string
  created_at: string
  updated_at: string
  group?: Group | null
}

export interface MeetingContact {
  name: string
  title: string
  photo_url: string | null
  sort_order: number
}

export interface Event {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  location: string | null
  type: 'mandatory' | 'optional'
  talking_points: string | null
  meeting_with: MeetingContact[] | null
  trip_id: string
  created_at: string
  updated_at: string
}

export interface TripTheme {
  primary: string
  secondary: string
  accent: string
  alert: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
}

export const DEFAULT_TRIP_THEME: TripTheme = {
  primary: '#3B82F6',
  secondary: '#1E293B',
  accent: '#F59E0B',
  alert: '#D97706',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#334155',
}

export const LIGHT_TRIP_THEME: TripTheme = {
  primary: '#2563EB',
  secondary: '#E2E8F0',
  accent: '#D97706',
  alert: '#B45309',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  border: '#CBD5E1',
}

export interface Trip {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  logo_url: string | null
  created_by: string | null
  created_at: string
  role?: 'super' | 'admin'
  theme?: TripTheme | null
}