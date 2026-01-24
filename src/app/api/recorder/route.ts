import { NextResponse } from 'next/server';
import { sessionRecorder } from '@/lib/session-recorder';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const status = sessionRecorder.getStatus();
        return NextResponse.json(status);
    } catch (error) {
        console.error('Error getting recorder status:', error);
        return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'start') {
            sessionRecorder.start();
            return NextResponse.json({ message: 'Session recorder started', status: sessionRecorder.getStatus() });
        } else if (action === 'stop') {
            sessionRecorder.stop();
            return NextResponse.json({ message: 'Session recorder stopped', status: sessionRecorder.getStatus() });
        } else {
            return NextResponse.json({ error: 'Invalid action. Use "start" or "stop"' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error controlling recorder:', error);
        return NextResponse.json({ error: 'Failed to control recorder' }, { status: 500 });
    }
}
