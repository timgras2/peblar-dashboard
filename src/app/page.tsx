'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, AreaChart, Area,
  RadialBarChart, RadialBar
} from 'recharts';
import {
  Battery, Zap, Clock, Euro,
  TrendingUp, Activity, Calendar, Droplets, Trash2
} from 'lucide-react';

// --- Interfaces ---
interface ChargingStatus {
  power: number;
  energy: number;
  status: number;
  vehicleInfo: string;
  sessionStart: string | null;
}

interface ChargingSession {
  id: number;
  startTime: string; // Date string from JSON
  endTime: string;
  energy: number;
  maxPower: number;
  status: number;
}

interface DashboardSession {
  id: number;
  date: string;
  startTime: string;
  rawStartTime: Date;
  duration: number;
  energy: number;
  cost: number;
  avgPower: number;
}

// --- Mock Data --- removed per request

export default function Home() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [powerData, setPowerData] = useState<any[]>([]);

  // Real Data State
  const [currentStatus, setCurrentStatus] = useState<ChargingStatus | null>(null);
  const currentStatusRef = useRef<number>(0);

  const [sessionHistory, setSessionHistory] = useState<DashboardSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync ref with state for use in intervals
  useEffect(() => {
    currentStatusRef.current = currentStatus?.power || 0;
  }, [currentStatus?.power]);

  // Constants
  const ENERGY_COST_PER_KWH = 0.30; // Example rate

  useEffect(() => {
    // Set initial time to avoid hydration mismatch
    setCurrentTime(new Date());

    // Clock timer
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Data fetching
    const fetchData = async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        // Fetch status
        const baseUrl = window.location.origin;
        const statusRes = await fetch(`${baseUrl}/api/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setCurrentStatus(statusData);
        }

        // Fetch sessions
        const sessionsRes = await fetch(`${baseUrl}/api/sessions`);
        if (sessionsRes.ok) {
          const sessionsData: ChargingSession[] = await sessionsRes.json();

          // Transform to dashboard format
          const formattedSessions = sessionsData.map((s) => {
            const start = new Date(s.startTime);
            const end = new Date(s.endTime);
            const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

            return {
              id: s.id, // Use the real ID from the backend
              date: start.toLocaleDateString(),
              startTime: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              rawStartTime: start,
              duration: durationMin > 0 ? durationMin : 0,
              energy: s.energy,
              cost: s.energy * ENERGY_COST_PER_KWH,
              avgPower: durationMin > 0 ? (s.energy / (durationMin / 60)) : 0
            } as DashboardSession;
          });
          setSessionHistory(formattedSessions);
        }
        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load charging data");
      } finally {
        if (isInitial) setLoading(false);
      }
    };

    fetchData(true);
    const dataInterval = setInterval(() => fetchData(false), 5000); // Poll every 5s

    // Simulate real-time power updates for the graph (visual flair)
    const powerTimer = setInterval(() => {
      setPowerData(prev => {
        const entry = {
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
          power: currentStatusRef.current
        };
        const newData = [...prev, entry];
        // Keep last 30 points
        return newData.slice(-30);
      });
    }, 2000);

    return () => {
      clearInterval(timer);
      clearInterval(powerTimer);
      clearInterval(dataInterval);
    };
  }, []); // Empty dependency array for stability

  const handleDeleteSession = async (id: number) => {
    if (!confirm('Are you sure you want to delete this charging session?')) return;

    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${baseUrl}/api/sessions?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Update local state to reflect deletion immediately
        setSessionHistory(prev => prev.filter(s => s.id !== id));
      } else {
        const errorData = await res.json();
        alert(`Failed to delete session: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      alert('An error occurred while deleting the session');
    }
  };

  // Derived Stats
  const totalEnergy = sessionHistory.reduce((sum, s) => sum + s.energy, 0);
  const totalCost = sessionHistory.reduce((sum, s) => sum + s.cost, 0);
  const avgSessionEnergy = sessionHistory.length > 0 ? totalEnergy / sessionHistory.length : 0;
  const avgSessionDuration = sessionHistory.length > 0 ? sessionHistory.reduce((sum, s) => sum + s.duration, 0) / sessionHistory.length : 0;

  // Calculate Trends (Last 7 days vs previous 7 days)
  const calculateTrend = (data: DashboardSession[]) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const last7Days = data.filter(s => s.rawStartTime >= sevenDaysAgo);
    const prev7Days = data.filter(s => s.rawStartTime >= fourteenDaysAgo && s.rawStartTime < sevenDaysAgo);

    const last7Sum = last7Days.reduce((sum, s) => sum + s.energy, 0);
    const prev7Sum = prev7Days.reduce((sum, s) => sum + s.energy, 0);

    if (prev7Sum === 0) return null;
    return Math.round(((last7Sum - prev7Sum) / prev7Sum) * 100);
  };

  const energyTrend = calculateTrend(sessionHistory);
  const costTrend = energyTrend; // They track linearly since cost = energy * rate

  const getVehicleStatus = (state: string | undefined) => {
    switch (state) {
      case 'State A': return 'No Vehicle Connected';
      case 'State B': return 'Connected (Idle/Wait)';
      case 'State C': return 'Charging actively';
      case 'State D': return 'Charging (Ventilation Req.)';
      case 'State E': return 'Error / Disconnected';
      case 'State F': return 'Charger Fault';
      default: return state || '--';
    }
  };

  // Components
  const StatCard = ({ icon: Icon, title, value, unit, color, trend, subtitle }: any) => (
    <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 transform transition-all duration-300 hover:scale-105 hover:shadow-xl" style={{ borderTopColor: color }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            {value}
            <span className="text-lg text-gray-500 ml-1">{unit}</span>
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="p-3 rounded-xl shadow-sm" style={{ backgroundColor: `${color}15` }}>
          <Icon size={24} style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center text-xs">
          <TrendingUp size={14} className="mr-1" style={{ color: trend > 0 ? '#10b981' : '#ef4444' }} />
          <span style={{ color: trend > 0 ? '#10b981' : '#ef4444' }}>
            {trend > 0 ? '+' : ''}{trend}% vs last week
          </span>
        </div>
      )}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-xl border border-gray-200">
          <p className="text-sm font-semibold text-gray-800 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium text-blue-600">
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value} {entry.unit || ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Peblar Charging Dashboard
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <Activity size={16} className="text-green-500 animate-pulse" />
                Live monitoring • Last updated: {currentTime ? currentTime.toLocaleTimeString() : '--:--:--'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Current Date</p>
              <p className="text-lg font-semibold text-gray-700">
                {currentTime ? currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '...'}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {/* Current Session - Enhanced */}
        <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-8 mb-8 text-white relative overflow-hidden">
          {/* Animated background effect */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-300 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                  <Zap size={28} className="animate-pulse" />
                </div>
                Active Charging Session
              </h2>
              <div className="flex items-center gap-3">
                <span className="bg-green-400 px-4 py-2 rounded-full text-sm font-bold uppercase shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  {currentStatus?.status === 1 ? 'CHARGING' : 'READY/IDLE'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4 border border-white border-opacity-20">
                <p className="text-blue-100 text-sm mb-1">Current Power</p>
                <p className="text-3xl font-bold">{currentStatus?.power || 0} kW</p>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4 border border-white border-opacity-20">
                <p className="text-blue-100 text-sm mb-1">Energy Delivered</p>
                <p className="text-3xl font-bold">{currentStatus?.energy || 0} kWh</p>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4 border border-white border-opacity-20">
                <p className="text-blue-100 text-sm mb-1">Duration</p>
                <p className="text-3xl font-bold">
                  {currentStatus?.sessionStart && currentTime
                    ? Math.floor((currentTime.getTime() - new Date(currentStatus.sessionStart).getTime()) / 60000)
                    : '--'} min
                </p>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4 border border-white border-opacity-20 flex flex-col justify-center">
                <p className="text-blue-100 text-sm mb-1">Vehicle Info</p>
                <p className="text-xl font-bold leading-tight">{getVehicleStatus(currentStatus?.vehicleInfo)}</p>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4 border border-white border-opacity-20">
                <p className="text-blue-100 text-sm mb-1">Est. Cost</p>
                <p className="text-3xl font-bold">€{((currentStatus?.energy || 0) * ENERGY_COST_PER_KWH).toFixed(2)}</p>
              </div>
            </div>

            {/* Real-time Power Graph */}
            <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4 border border-white border-opacity-20">
              <p className="text-sm font-medium mb-3">Power Draw (Simulated Real-time)</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={powerData}>
                  <defs>
                    <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fff" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#fff" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <Area
                    type="monotone"
                    dataKey="power"
                    name="Power"
                    unit=" kW"
                    stroke="#fff"
                    strokeWidth={2}
                    fill="url(#powerGradient)"
                    animationDuration={300}
                    isAnimationActive={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Stats Grid - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Zap}
            title="Total Energy"
            value={totalEnergy.toFixed(1)}
            unit="kWh"
            color="#3b82f6"
            trend={energyTrend}
            subtitle="Recorded Sessions"
          />
          <StatCard
            icon={Euro}
            title="Total Cost"
            value={`€${totalCost.toFixed(2)}`}
            unit=""
            color="#10b981"
            trend={costTrend}
            subtitle="Estimated"
          />
          <StatCard
            icon={Battery}
            title="Avg Session"
            value={avgSessionEnergy.toFixed(1)}
            unit="kWh"
            color="#8b5cf6"
            subtitle="Per charging session"
          />
          <StatCard
            icon={Clock}
            title="Avg Duration"
            value={Math.round(avgSessionDuration)}
            unit="min"
            color="#f59e0b"
            subtitle="Per charging session"
          />
        </div>

        {/* Charts Row - Only show if we have trend data (currently hidden as we lack historical API) */}
        {false && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Weekly Energy */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Weekly Energy Usage</h3>
                <Calendar size={20} className="text-gray-400" />
              </div>
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No historical data available
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">6-Month Trend</h3>
                <TrendingUp size={20} className="text-green-500" />
              </div>
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No historical data available
              </div>
            </div>
          </div>
        )}

        {/* Session History - Enhanced */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Activity size={24} className="text-blue-600" />
            Recent Charging Sessions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">Start Time</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">Duration</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">Energy</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">Avg Power</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">Cost</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessionHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No charging sessions recorded
                    </td>
                  </tr>
                )}
                {sessionHistory.map((session, idx) => (
                  <tr
                    key={session.id}
                    className={`border-b border-gray-100 transition-all duration-200 hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    <td className="py-4 px-4 text-sm font-medium text-gray-700">{session.date}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{session.startTime}</td>
                    <td className="py-4 px-4 text-sm text-right text-gray-600">{session.duration} min</td>
                    <td className="py-4 px-4 text-sm text-right">
                      <span className="font-semibold text-blue-600">{session.energy.toFixed(1)} kWh</span>
                    </td>
                    <td className="py-4 px-4 text-sm text-right text-gray-600">{session.avgPower.toFixed(2)} kW</td>
                    <td className="py-4 px-4 text-sm text-right">
                      <span className="font-bold text-green-600">€{session.cost.toFixed(2)}</span>
                    </td>
                    <td className="py-4 px-4 text-sm text-right">
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors duration-200 rounded-lg hover:bg-red-50"
                        title="Delete Session"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
