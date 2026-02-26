import { NextResponse } from 'next/server';
import { sessionDB } from '@/lib/db';
import { config } from '@/config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (config.demoMode) {
    const now = new Date();
    return NextResponse.json([
      {
        id: 101,
        startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 4 * 3600000).toISOString(),
        energy: 42.5,
        maxPower: 11.2,
        status: 1
      },
      {
        id: 102,
        startTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 2 * 3600000).toISOString(),
        energy: 22.1,
        maxPower: 11.0,
        status: 1
      }
    ]);
  }

  try { 
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const sessions = sessionDB.getSessions(days);

    const formattedSessions = sessions.map(session => ({
      id: session.id,
      startTime: session.start_time,
      endTime: session.end_time,
      energy: session.energy_kwh,
      maxPower: session.max_power_kw,
      cost: session.cost || 0,
      avgPrice: session.avg_price_eur || 0,
      status: 1
    }));

    return NextResponse.json(formattedSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json([]);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const id = parseInt(idParam || '');

    console.log(`[DELETE] Request for ID: ${idParam} (parsed: ${id})`);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const success = sessionDB.deleteSession(id);

    if (success) {
      console.log(`[DELETE] Success for ID: ${id}`);
      return NextResponse.json({ success: true });
    } else {
      console.log(`[DELETE] Not found ID: ${id}`);
      // Fallback: Check if the ID exists as a string vs number
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}