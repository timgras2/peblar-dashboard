// Auto-start the session recorder when the server starts
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('🚀 Initializing Peblar Monitor...');

        // Dynamic import to avoid issues with better-sqlite3
        const { sessionRecorder } = await import('./lib/session-recorder');

        // Start the session recorder
        sessionRecorder.start();

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down gracefully...');
            sessionRecorder.stop();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down gracefully...');
            sessionRecorder.stop();
            process.exit(0);
        });
    }
}
