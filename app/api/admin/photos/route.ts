import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  // Step 1: Verify authenticated
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Step 2: Verify trip access
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Step 3: List all files in trip-photos/{tripId}/
  // List top-level folders (participant IDs) first, then files within each
  const { data: participantFolders, error: listError } = await supabaseAdmin.storage
    .from('trip-photos')
    .list(access.tripId, { limit: 1000 })

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  // Collect all photo files from participant subfolders
  const photos: { name: string; path: string; url: string }[] = []

  for (const folder of participantFolders || []) {
    // Skip non-folder entries (files at the trip root level)
    if (folder.metadata && folder.metadata.mimetype) continue

    const { data: files } = await supabaseAdmin.storage
      .from('trip-photos')
      .list(`${access.tripId}/${folder.name}`, { limit: 1000 })

    if (!files) continue

    for (const file of files) {
      // Skip placeholder files or non-image entries
      if (!file.name || file.name === '.emptyFolderPlaceholder') continue

      const filePath = `${access.tripId}/${folder.name}/${file.name}`
      const { data: signedUrl } = await supabaseAdmin.storage
        .from('trip-photos')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (signedUrl?.signedUrl) {
        photos.push({
          name: file.name,
          path: filePath,
          url: signedUrl.signedUrl,
        })
      }
    }
  }

  return NextResponse.json({ photos, count: photos.length })
}
