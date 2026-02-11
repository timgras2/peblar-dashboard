import { config } from '@/config';
import { sessionDB, Session } from './db';
import { energyPriceService } from './energy-prices';
import { sendTelegramNotification } from './telegram';

interface ChargerState {
    isCharging: boolean;
    power: number;
    energy: number;
    sessionStart: Date | null;
    sessionStartEnergy: number;
    lastRecordedEnergy: number;
    currentSessionCost: number;
    maxPower: number;
}

class SessionRecorder {
    private state: ChargerState = {
        isCharging: false,
        power: 0,
        energy: 0,
        sessionStart: null,
        sessionStartEnergy: 0,
        lastRecordedEnergy: 0,
        currentSessionCost: 0,
        maxPower: 0
    };

    private intervalId: NodeJS.Timeout | null = null;
    private readonly POLL_INTERVAL = 60000; // 1 minute

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
                    this.onSessionStart(0, currentPower);
                    this.state.lastRecordedEnergy = currentEnergy;
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
            } else if (isCurrentlyCharging && !this.state.sessionStart) {
                 // Recovery: Charging but no start time (e.g. after restart or bug)
                 console.warn('⚠️ Charging detected but no session start recorded. Recovering...');
                 this.onSessionStart(currentEnergy, currentPower);
            }

            // Record incremental cost during charging
            if (isCurrentlyCharging) {
                const energyDelta = currentEnergy - this.state.lastRecordedEnergy;
                if (energyDelta > 0) {
                    const currentPrice = await energyPriceService.getCurrentPrice();
                    this.state.currentSessionCost += energyDelta * currentPrice;
                    this.state.lastRecordedEnergy = currentEnergy;
                }

                // Update max power during charging
                if (currentPower > this.state.maxPower) {
                    this.state.maxPower = currentPower;
                }
            }

            // Detect session end
            if (!isCurrentlyCharging && this.state.isCharging) {
                this.onSessionEnd(currentEnergy, statusData.CpState);
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
        this.state.lastRecordedEnergy = energy;
        this.state.currentSessionCost = 0;
        this.state.maxPower = power;
    }

    /**
     * Handle session end and save to database
     */
    private async onSessionEnd(finalEnergy: number, finalState: string = 'Unknown') {
        if (!this.state.sessionStart) {
            if (finalEnergy > 0.1) {
                console.warn('Session end detected but no start time recorded.');
                this.state.sessionStart = new Date(Date.now() - 3600000);
                this.state.sessionStartEnergy = 0;
            } else {
                this.resetState();
                return;
            }
        }

        const sessionEnd = new Date();
        const energyConsumed = finalEnergy - this.state.sessionStartEnergy;
        
        // Prepare notification message
        const stateLabel = this.getStateLabel(finalState);
        let notificationMsg = '';
        if (finalState === 'State E' || finalState === 'State F') {
            notificationMsg = `⚠️ Charging Error!\nStatus: ${stateLabel}\nEnergy delivered: ${energyConsumed.toFixed(2)} kWh`;
        } else {
             notificationMsg = `✅ Charging Finished\nStatus: ${stateLabel}\nEnergy: ${energyConsumed.toFixed(2)} kWh\nCost: €${this.state.currentSessionCost.toFixed(2)}`;
        }
        
        // Send notification
        await sendTelegramNotification(notificationMsg);

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
            cost: this.state.currentSessionCost,
            avg_price_eur: energyConsumed > 0 ? this.state.currentSessionCost / energyConsumed : 0,
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
        this.state.lastRecordedEnergy = 0;
        this.state.currentSessionCost = 0;
        this.state.maxPower = 0;
    }

    /**
     * Convert CP State to human-readable label
     */
    private getStateLabel(state: string): string {
        switch (state) {
            case 'State A': return 'No Vehicle Connected';
            case 'State B': return 'Connected (Idle/Wait)';
            case 'State C': return 'Charging actively';
            case 'State D': return 'Charging (Ventilation Req.)';
            case 'State E': return 'Error / Disconnected';
            case 'State F': return 'Charger Fault';
            default: return state;
        }
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
