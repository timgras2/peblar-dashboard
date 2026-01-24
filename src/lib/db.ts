import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'sessions.json');

export interface Session {
  id?: number;
  start_time: string;
  end_time: string;
  energy_kwh: number;
  max_power_kw: number;
  avg_power_kw?: number;
  cost?: number;
  status?: string;
  created_at?: string;
}

interface SessionData {
  sessions: Session[];
  lastId: number;
}

class SessionDB {
  private dataPath: string;

  constructor() {
    this.dataPath = DB_PATH;
    this.ensureDataFile();
  }

  private ensureDataFile() {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dataPath)) {
      this.writeData({ sessions: [], lastId: 0 });
    }
  }

  private readData(): SessionData {
    try {
      if (!fs.existsSync(this.dataPath)) return { sessions: [], lastId: 0 };
      const data = fs.readFileSync(this.dataPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading sessions data:', error);
      return { sessions: [], lastId: 0 };
    }
  }

  private writeData(data: SessionData) {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing sessions data:', error);
    }
  }

  insertSession(session: Session): number {
    const data = this.readData();
    const newId = data.lastId + 1;

    const newSession: Session = {
      ...session,
      id: newId,
      created_at: new Date().toISOString()
    };

    data.sessions.push(newSession);
    data.lastId = newId;

    this.writeData(data);
    return newId;
  }

  getSessions(days: number = 30): Session[] {
    const data = this.readData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return data.sessions
      .filter(s => new Date(s.start_time) >= cutoffDate)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }

  getLatestSession(): Session | null {
    const data = this.readData();
    if (data.sessions.length === 0) return null;

    return data.sessions.reduce((latest, current) =>
      new Date(current.end_time) > new Date(latest.end_time) ? current : latest
    );
  }

  getStats(days: number = 7) {
    const sessions = this.getSessions(days);

    if (sessions.length === 0) {
      return {
        total_sessions: 0,
        total_energy: 0,
        avg_energy: 0,
        total_cost: 0,
        peak_power: 0
      };
    }

    return {
      total_sessions: sessions.length,
      total_energy: sessions.reduce((sum, s) => sum + s.energy_kwh, 0),
      avg_energy: sessions.reduce((sum, s) => sum + s.energy_kwh, 0) / sessions.length,
      total_cost: sessions.reduce((sum, s) => sum + (s.cost || 0), 0),
      peak_power: Math.max(...sessions.map(s => s.max_power_kw))
    };
  }

  getDailyStats(days: number = 7) {
    const sessions = this.getSessions(days);
    const dailyMap = new Map<string, { sessions: number; energy: number; cost: number }>();

    sessions.forEach(session => {
      const date = new Date(session.start_time).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { sessions: 0, energy: 0, cost: 0 };

      dailyMap.set(date, {
        sessions: existing.sessions + 1,
        energy: existing.energy + session.energy_kwh,
        cost: existing.cost + (session.cost || 0)
      });
    });

    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  deleteSession(id: any): boolean {
    const data = this.readData();
    const initialLength = data.sessions.length;

    // Convert both to string to be absolutely sure of match
    data.sessions = data.sessions.filter(s => String(s.id) !== String(id));

    if (data.sessions.length < initialLength) {
      this.writeData(data);
      return true;
    }
    return false;
  }
}

export const sessionDB = new SessionDB();