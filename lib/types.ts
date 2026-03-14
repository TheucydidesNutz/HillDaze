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

export interface Event {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  location: string | null
  type: 'mandatory' | 'optional'
  trip_id: string
  created_at: string
  updated_at: string
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
}