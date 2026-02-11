import { NextResponse } from 'next/server';
import { sessionDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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