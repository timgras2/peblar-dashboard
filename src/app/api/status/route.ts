import { NextResponse } from 'next/server';
import { config } from '@/config';

export const dynamic = 'force-dynamic';

// Auto-start session recorder on first API call
export async function GET() {
  try {
    // Fetch both status and meter data in parallel
    const baseUrl = `${config.api.baseUrl}:${config.api.port}`;

    const [statusRes, meterRes] = await Promise.all([
      fetch(`${baseUrl}${config.api.endpoints.status}`, {
        headers: { 'Authorization': config.api.token },
        cache: 'no-store'
      }),
      fetch(`${baseUrl}${config.api.endpoints.meter}`, {
        headers: { 'Authorization': config.api.token },
        cache: 'no-store'
      })
    ]);

    if (!statusRes.ok || !meterRes.ok) {
      throw new Error(`Failed to fetch: Status ${statusRes.status}, Meter ${meterRes.status}`);
    }

    const statusData = await statusRes.json();
    const meterData = await meterRes.json();

    const { sessionRecorder } = await import('@/lib/session-recorder');
    const recorderStatus = sessionRecorder.getStatus();

    return NextResponse.json({
      power: (meterData.PowerTotal || 0) / 1000,
      energy: (meterData.EnergySession || 0) / 1000,
      status: statusData.CpState === 'State C' ? 1 : 0,
      vehicleInfo: statusData.CpState || "Unknown",
      sessionStart: recorderStatus.currentState.sessionStart
    });
  } catch (error) {
    console.error('Failed to read charging status:', error);
    return NextResponse.json(
      { error: 'Failed to read charging status' },
      { status: 500 }
    );
  }
} 