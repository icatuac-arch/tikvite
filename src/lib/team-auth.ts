/**
 * Check if a user has team-level access to an event.
 * Returns the role if they do, null if not.
 */
export async function getTeamRole(
  supabase: any,
  eventId: string,
  userId: string,
  userEmail: string,
): Promise<'owner' | 'organizer' | 'checkin' | 'viewer' | null> {
  // Check if user owns the event
  const { data: event } = await supabase
    .from('events')
    .select('publisher_id')
    .eq('id', eventId)
    .single()

  if (event?.publisher_id === userId) return 'owner'

  // Check team membership
  const { data: member } = await supabase
    .from('event_team_members')
    .select('role')
    .eq('event_id', eventId)
    .or(`user_id.eq.${userId},user_email.eq.${userEmail}`)
    .maybeSingle()

  if (member) return member.role as 'organizer' | 'checkin' | 'viewer'

  // Check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role === 'admin') return 'owner'

  return null
}

/** Check if a role can perform check-in */
export function canCheckIn(role: string | null): boolean {
  return role === 'owner' || role === 'organizer' || role === 'checkin'
}

/** Check if a role can manage event settings */
export function canManage(role: string | null): boolean {
  return role === 'owner' || role === 'organizer'
}
