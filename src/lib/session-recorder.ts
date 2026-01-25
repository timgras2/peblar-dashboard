import { config } from '@/config';
import { sessionDB, Session } from './db';

interface ChargerState {
    isCharging: boolean;
    power: number;
    energy: number;
    sessionStart: Date | null;
    sessionStartEnergy: number;
    maxPower: number;
}

class SessionRecorder {
    private state: ChargerState = {
        isCharging: false,
        power: 0,
        energy: 0,
        sessionStart: null,
        sessionStartEnergy: 0,
        maxPower: 0
    };

    private intervalId: NodeJS.Timeout | null = null;
    private readonly POLL_INTERVAL = 60000; // 1 minute
    private readonly ENERGY_COST_PER_KWH = 0.30; // €0.30 per kWh

    /**
     * Start the background recorder
     */
    async start() {
        if (this.intervalId) {
            console.log('Session recorder already running');
            return;
        }

        console.log('🔄 Starting session recorder...');

        // Initial check to prime the state without starting a session
        await this.initializeState();

        // Poll every minute
        this.intervalId = setInterval(() => {
            this.checkChargerStatus();
        }, this.POLL_INTERVAL);
    }

    /**
     * Initial state fetch to prevent starting a session mid-charge
     */
    private async initializeState() {
        try {
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

            if (statusRes.ok && meterRes.ok) {
                const statusData = await statusRes.json();
                const meterData = await meterRes.json();

                const isCharging = statusData.CpState === 'State C' || statusData.CpState === 'State D';
                const currentPower = (meterData.PowerTotal || 0) / 1000;
                const currentEnergy = (meterData.EnergySession || 0) / 1000;

                this.state.isCharging = isCharging;
                this.state.power = currentPower;
                this.state.energy = currentEnergy;

                if (isCharging) {
                    // If we initialized during a charge, we don't know the exact start time,
                    // but we can set up the state so it records when it ends.
                    // We assume EnergySession is already accounting for the session energy.
                    this.onSessionStart(0, currentPower);
                    console.log(`📡 Recorder detected ongoing charge: ${currentEnergy.toFixed(2)} kWh already consumed.`);
                } else {
                    console.log(`📡 Recorder initial state: IDLE`);
                }
            }
        } catch (error) {
            console.error('Failed to initialize recorder state:', error);
        }
    }

    /**
     * Stop the background recorder
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏹️  Session recorder stopped');
        }
    }

    /**
     * Check current charger status and detect session changes
     */
    private async checkChargerStatus() {
        try {
            const baseUrl = `${config.api.baseUrl}:${config.api.port}`;

            // Fetch current status and meter data
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
                console.error('Failed to fetch charger status');
                return;
            }

            const statusData = await statusRes.json();
            const meterData = await meterRes.json();

            const isCurrentlyCharging = statusData.CpState === 'State C' || statusData.CpState === 'State D';
            const currentPower = (meterData.PowerTotal || 0) / 1000; // Convert to kW
            const currentEnergy = (meterData.EnergySession || 0) / 1000; // Convert to kWh

            // Detect session start
            if (isCurrentlyCharging && !this.state.isCharging) {
                this.onSessionStart(currentEnergy, currentPower);
            }

            // Update max power during charging
            if (isCurrentlyCharging && currentPower > this.state.maxPower) {
                this.state.maxPower = currentPower;
            }

            // Detect session end
            if (!isCurrentlyCharging && this.state.isCharging) {
                this.onSessionEnd(currentEnergy);
            }

            // Update state
            this.state.isCharging = isCurrentlyCharging;
            this.state.power = currentPower;
            this.state.energy = currentEnergy;

        } catch (error) {
            console.error('Error checking charger status:', error);
        }
    }

    /**
     * Handle session start
     */
    private onSessionStart(energy: number, power: number, startTime?: Date) {
        console.log('⚡ Charging session started (or detected)');
        this.state.sessionStart = startTime || new Date();
        this.state.sessionStartEnergy = energy;
        this.state.maxPower = power;
    }

    /**
     * Handle session end and save to database
     */
    private onSessionEnd(finalEnergy: number) {
        if (!this.state.sessionStart) {
            // If we missed the start but have energy in EnergySession, 
            // we can assume the session just finished and record what we can
            if (finalEnergy > 0.1) {
                console.warn('Session end detected but no start time recorded. Recording from current session energy.');
                this.state.sessionStart = new Date(Date.now() - 3600000); // Assume it started an hour ago as proxy
                this.state.sessionStartEnergy = 0; // Use the full session energy
            } else {
                console.warn('Session end detected but no start time or energy recorded');
                this.resetState();
                return;
            }
        }

        const sessionEnd = new Date();
        const energyConsumed = finalEnergy - this.state.sessionStartEnergy;

        // Only save if meaningful energy was consumed (> 0.1 kWh)
        if (energyConsumed < 0.1) {
            console.log('⚠️  Session too short, not recording');
            this.resetState();
            return;
        }

        const session: Session = {
            start_time: this.state.sessionStart.toISOString(),
            end_time: sessionEnd.toISOString(),
            energy_kwh: energyConsumed,
            max_power_kw: this.state.maxPower,
            avg_power_kw: this.calculateAvgPower(energyConsumed, this.state.sessionStart, sessionEnd),
            cost: energyConsumed * this.ENERGY_COST_PER_KWH,
            status: 'completed'
        };

        try {
            const sessionId = sessionDB.insertSession(session);
            console.log(`✅ Session saved (ID: ${sessionId}): ${energyConsumed.toFixed(2)} kWh, €${session.cost?.toFixed(2)}`);
        } catch (error) {
            console.error('Failed to save session:', error);
        }

        this.resetState();
    }

    /**
     * Calculate average power
     */
    private calculateAvgPower(energy: number, start: Date, end: Date): number {
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return durationHours > 0 ? energy / durationHours : 0;
    }

    /**
     * Reset session state
     */
    private resetState() {
        this.state.sessionStart = null;
        this.state.sessionStartEnergy = 0;
        this.state.maxPower = 0;
    }

    /**
     * Get current recorder status
     */
    getStatus() {
        return {
            running: this.intervalId !== null,
            currentState: this.state
        };
    }
}

// Export singleton instance
export const sessionRecorder = new SessionRecorder();
