// db.ts — Database operations and utility functions

import { supabase } from './config.ts'
import type { User } from './types.ts'

export async function updateUserInDB(userId: string, user: User, nextStep: string) {
  const updateData: Record<string, any> = {
    onboarding_step: nextStep,
    updated_at: new Date().toISOString()
  }

  if (user.preferred_language) updateData.preferred_language = user.preferred_language
  if (user.full_name) updateData.full_name = user.full_name
  if (user.age) updateData.age = user.age
  if (user.gender) updateData.gender = user.gender
  if (user.location_city) updateData.location_city = user.location_city
  if (user.location_state) updateData.location_state = user.location_state
  if (user.latitude) updateData.latitude = user.latitude
  if (user.longitude) updateData.longitude = user.longitude
  if (user.onboarding_status) updateData.onboarding_status = user.onboarding_status
  if (user.conversation_state) updateData.conversation_state = user.conversation_state

  const { error } = await supabase
    .from('applicants')
    .update(updateData)
    .eq('id', userId)

  if (error) {
    console.error('User update failed:', error)
  }
}

export function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export async function handleThanosReset(user: User): Promise<{ response: string, updatedUser: User }> {
  console.log(`💎 THANOS SNAP: Resetting user ${user.id}`)

  const { error } = await supabase
    .from('applicants')
    .update({
      onboarding_status: 'new',
      onboarding_step: null,
      conversation_state: null,
      full_name: null,
      ic_number: null,
      age: null,
      gender: null,
      preferred_language: null,
      location_city: null,
      location_state: null,
      preferred_job_types: null,
      preferred_positions: null,
      years_experience: null,
      has_transport: null,
      is_oku: null,
      latitude: null,
      longitude: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (error) {
    console.error('Thanos snap failed:', error)
    return {
      response: "The stones failed... Try again.",
      updatedUser: user
    }
  }

  const resetUser: User = {
    id: user.id,
    phone_number: user.phone_number,
    onboarding_status: 'new'
  }

  return {
    response: `*snap* 💎

I am inevitable...

Your profile has been reduced to atoms.
Perfectly balanced, as all things should be.

Send any message to start fresh.`,
    updatedUser: resetUser
  }
}

export function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
}
