import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess } from '@/lib/supabase'
import JSZip from 'jszip'

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
  const { data: participantFolders, error: listError } = await supabaseAdmin.storage
    .from('trip-photos')
    .list(access.tripId, { limit: 1000 })

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  const zip = new JSZip()
  let photoCount = 0

  for (const folder of participantFolders || []) {
    // Skip non-folder entries
    if (folder.metadata && folder.metadata.mimetype) continue

    const { data: files } = await supabaseAdmin.storage
      .from('trip-photos')
      .list(`${access.tripId}/${folder.name}`, { limit: 1000 })

    if (!files) continue

    for (const file of files) {
      if (!file.name || file.name === '.emptyFolderPlaceholder') continue

      const filePath = `${access.tripId}/${folder.name}/${file.name}`
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('trip-photos')
        .download(filePath)

      if (downloadError || !fileData) continue

      // Add to zip with a readable folder structure: participant_id/filename
      const arrayBuf = await fileData.arrayBuffer()
      zip.file(`${folder.name}/${file.name}`, new Uint8Array(arrayBuf))
      photoCount++
    }
  }

  if (photoCount === 0) {
    return NextResponse.json({ error: 'No photos found for this trip' }, { status: 404 })
  }

  // Generate zip as arraybuffer and return via Response (which accepts ArrayBuffer)
  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="trip-photos-${access.tripId.slice(0, 8)}.zip"`,
    },
  })
}
