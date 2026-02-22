import { NextResponse } from 'next/server';
import { describeRhizomeConfig } from '@/server/rhizome/config';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'rhizome-cortex',
    config: describeRhizomeConfig(),
    timestamp: Date.now(),
  });
}
