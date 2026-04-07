import { NextRequest, NextResponse } from 'next/server'
import { addReaction } from '@/lib/echoes'

// POST /api/echoes/[id]/react
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Echo ID is required.' }, { status: 400 })
  }

  try {
    const result = await addReaction(id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/echoes/[id]/react]', err)
    return NextResponse.json({ error: 'Failed to add reaction.' }, { status: 500 })
  }
}
