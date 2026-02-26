import { NextResponse } from 'next/server';
import { config } from '@/config';

export const dynamic = 'force-dynamic';

// Auto-start session recorder on first API call
export async function GET() {
  if (config.demoMode) {
    const mockPower = 10.5 + Math.random(); // Fluctuating power around 11kW
    const mockEnergy = 12.4 + (Date.now() % 100000) / 10000; // Slowly increasing energy
    
    return NextResponse.json({
      power: mockPower,
      energy: mockEnergy,
      status: 1,
      vehicleInfo: "State C",
      sessionStart: new Date(Date.now() - 3600000).toISOString(),
      currentPrice: 0.35,
      demoMode: true
    });
  }

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
    const { energyPriceService } = await import('@/lib/energy-prices');
    
    const recorderStatus = sessionRecorder.getStatus();
    
    // Ensure recorder is running (fallback for when instrumentation hook doesn't fire)
    if (!recorderStatus.running) {
        console.log('⚠️ Session recorder not running (lazy start triggered)');
        sessionRecorder.start();
    }

    const currentPrice = await energyPriceService.getCurrentPrice();

    return NextResponse.json({
      power: (meterData.PowerTotal || 0) / 1000,
      energy: (meterData.EnergySession || 0) / 1000,
      status: (statusData.CpState === 'State C' || statusData.CpState === 'State D') ? 1 : 0,
      vehicleInfo: statusData.CpState || "Unknown",
      sessionStart: recorderStatus.currentState.sessionStart,
      currentPrice: currentPrice
    });
  } catch (error) {
    console.error('Failed to read charging status:', error);
    return NextResponse.json(
      { error: 'Failed to read charging status' },
      { status: 500 }
    );
  }
} 