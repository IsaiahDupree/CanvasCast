"use client";

/**
 * Admin Cost Dashboard
 * ADMIN-005: Cost Dashboard
 *
 * Displays:
 * - Total API costs
 * - Breakdown by service (OpenAI, Gemini, Storage)
 * - Daily cost trends with charts
 * - Date range filtering
 */

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Calendar, RefreshCw } from "lucide-react";

interface CostData {
  totalCost: number;
  dateRange: {
    start: string;
    end: string;
  };
  breakdown: {
    openai: number;
    gemini: number;
    storage: number;
  };
  daily: Array<{
    date: string;
    openai: number;
    gemini: number;
    storage: number;
    total: number;
  }>;
  byService: Array<{
    service: string;
    operations: Record<string, number>;
  }>;
}

type DateRange = 'today' | 'week' | 'month' | 'quarter';

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('week');

  useEffect(() => {
    fetchCostData();
  }, [dateRange]);

  const fetchCostData = async () => {
    if (!loading) {
      setRefreshing(true);
    }

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/costs/summary?range=${dateRange}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch cost data");
      }

      const costData = await response.json();
      setData(costData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getAuthToken = async () => {
    const supabase = await import("@/lib/supabase/client").then((mod) => mod.createClient());
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  const getServiceColor = (service: string): string => {
    switch (service) {
      case 'openai':
        return 'text-green-400';
      case 'gemini':
        return 'text-blue-400';
      case 'storage':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const getServiceBgColor = (service: string): string => {
    switch (service) {
      case 'openai':
        return 'bg-green-500/20 border-green-500/30';
      case 'gemini':
        return 'bg-blue-500/20 border-blue-500/30';
      case 'storage':
        return 'bg-purple-500/20 border-purple-500/30';
      default:
        return 'bg-gray-500/20 border-gray-500/30';
    }
  };

  const getServiceLabel = (service: string): string => {
    switch (service) {
      case 'openai':
        return 'OpenAI';
      case 'gemini':
        return 'Gemini';
      case 'storage':
        return 'Storage';
      default:
        return service;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-400">Loading cost data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-400">No cost data available</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-brand-500" />
            Cost Dashboard
          </h1>
          <p className="text-gray-400 mt-2">Track API costs and usage across all services</p>
        </div>

        <button
          onClick={fetchCostData}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-white/10 rounded-lg text-white hover:bg-white/5 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6 flex gap-2">
        {(['today', 'week', 'month', 'quarter'] as DateRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setDateRange(range)}
            className={`px-4 py-2 rounded-lg border transition ${
              dateRange === range
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'bg-gray-900 border-white/10 text-gray-300 hover:bg-white/5'
            }`}
          >
            {range === 'today' && 'Today'}
            {range === 'week' && 'Last 7 Days'}
            {range === 'month' && 'Last 30 Days'}
            {range === 'quarter' && 'Last 90 Days'}
          </button>
        ))}
      </div>

      {/* Total Cost Card */}
      <div className="mb-6 bg-gradient-to-r from-brand-500/20 to-purple-500/20 border border-brand-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-6 h-6 text-brand-400" />
          <h2 className="text-xl font-bold">Total API Cost</h2>
        </div>
        <div className="text-4xl font-bold text-white mb-2">{formatCurrency(data.totalCost)}</div>
        <div className="text-sm text-gray-400">
          {data.dateRange.start} to {data.dateRange.end}
        </div>
      </div>

      {/* Breakdown by Service */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-brand-500" />
          Breakdown by Service
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(data.breakdown).map(([service, cost]) => (
            <div
              key={service}
              className={`border rounded-lg p-6 ${getServiceBgColor(service)}`}
            >
              <div className="text-sm text-gray-300 mb-1">{getServiceLabel(service)}</div>
              <div className={`text-3xl font-bold ${getServiceColor(service)}`}>
                {formatCurrency(cost)}
              </div>
              <div className="text-sm text-gray-400 mt-2">
                {data.totalCost > 0
                  ? `${((cost / data.totalCost) * 100).toFixed(1)}% of total`
                  : '0% of total'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Cost Trends */}
      {data.daily.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-500" />
            Daily Cost Trends
          </h2>
          <div className="bg-gray-900 border border-white/10 rounded-lg p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-green-400">OpenAI</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-blue-400">Gemini</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-purple-400">Storage</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-white">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.daily.map((day) => (
                    <tr key={day.date} className="hover:bg-white/5 transition">
                      <td className="px-4 py-4 text-gray-300">{day.date}</td>
                      <td className="px-4 py-4 text-right text-green-400 font-mono">
                        {formatCurrency(day.openai)}
                      </td>
                      <td className="px-4 py-4 text-right text-blue-400 font-mono">
                        {formatCurrency(day.gemini)}
                      </td>
                      <td className="px-4 py-4 text-right text-purple-400 font-mono">
                        {formatCurrency(day.storage)}
                      </td>
                      <td className="px-4 py-4 text-right font-bold font-mono">
                        {formatCurrency(day.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown by Operations */}
      {data.byService.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Cost by Operation Type</h2>
          <div className="space-y-4">
            {data.byService.map((serviceData) => {
              const operations = Object.entries(serviceData.operations);
              if (operations.length === 0) return null;

              return (
                <div
                  key={serviceData.service}
                  className={`border rounded-lg p-6 ${getServiceBgColor(serviceData.service)}`}
                >
                  <h3 className={`text-lg font-bold mb-4 ${getServiceColor(serviceData.service)}`}>
                    {getServiceLabel(serviceData.service)}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {operations.map(([operation, cost]) => (
                      <div key={operation} className="bg-black/20 rounded-lg p-4">
                        <div className="text-sm text-gray-300 mb-1 capitalize">{operation}</div>
                        <div className={`text-xl font-bold ${getServiceColor(serviceData.service)}`}>
                          {formatCurrency(cost)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Data State */}
      {data.daily.length === 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-lg p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-400 mb-2">No Cost Data</h3>
          <p className="text-gray-500">
            No API costs recorded for the selected time period.
          </p>
        </div>
      )}
    </div>
  );
}
