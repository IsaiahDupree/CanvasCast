/**
 * Tests for Admin Cost Dashboard (ADMIN-005)
 *
 * Tests the cost dashboard page that displays:
 * - Cost charts rendered
 * - Breakdown by service
 * - Date range filter
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CostsPage from '@/app/admin/costs/page';

// Mock the Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({
          data: {
            session: {
              access_token: 'mock-token',
            },
          },
        })
      ),
    },
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Admin Cost Dashboard (ADMIN-005)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('renders the cost dashboard title and description', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        totalCost: 0,
        dateRange: { start: '2026-01-13', end: '2026-01-20' },
        breakdown: { openai: 0, gemini: 0, storage: 0 },
        daily: [],
        byService: [],
      }),
    });

    render(<CostsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Cost Dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/API costs and usage/i)).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    render(<CostsPage />);

    expect(screen.getByText(/Loading cost data/i)).toBeInTheDocument();
  });

  it('fetches and displays cost data from API', async () => {
    const mockCostData = {
      totalCost: 125.50,
      dateRange: { start: '2026-01-13', end: '2026-01-20' },
      breakdown: {
        openai: 85.25,
        gemini: 35.00,
        storage: 5.25,
      },
      daily: [
        { date: '2026-01-13', openai: 12.50, gemini: 5.00, storage: 0.75, total: 18.25 },
        { date: '2026-01-14', openai: 15.75, gemini: 7.00, storage: 0.80, total: 23.55 },
        { date: '2026-01-15', openai: 10.00, gemini: 4.50, storage: 0.70, total: 15.20 },
      ],
      byService: [
        { service: 'openai', operations: { completion: 45.50, tts: 28.00, whisper: 11.75 } },
        { service: 'gemini', operations: { image: 35.00 } },
        { service: 'storage', operations: { upload: 3.25, bandwidth: 2.00 } },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostsPage />);

    await waitFor(() => {
      expect(screen.getByText('$125.50')).toBeInTheDocument();
    });

    // Check breakdown by service (may appear multiple times due to operations breakdown)
    const openAiCost = screen.getAllByText('$85.25');
    expect(openAiCost.length).toBeGreaterThan(0);

    const geminiCost = screen.getAllByText('$35.00');
    expect(geminiCost.length).toBeGreaterThan(0);

    const storageCost = screen.getAllByText('$5.25');
    expect(storageCost.length).toBeGreaterThan(0);
  });

  it('allows filtering by date range', async () => {
    const mockCostData = {
      totalCost: 100.00,
      dateRange: { start: '2026-01-01', end: '2026-01-07' },
      breakdown: { openai: 70.00, gemini: 25.00, storage: 5.00 },
      daily: [],
      byService: [],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Cost Dashboard/i)).toBeInTheDocument();
    });

    // Find date range buttons
    const weekButton = screen.getByText(/Last 7 Days/i);
    fireEvent.click(weekButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/admin/costs/summary'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });
  });

  it('displays error state when API fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<CostsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
    });
  });

  it('displays chart for daily cost trends', async () => {
    const mockCostData = {
      totalCost: 125.50,
      dateRange: { start: '2026-01-13', end: '2026-01-20' },
      breakdown: { openai: 85.25, gemini: 35.00, storage: 5.25 },
      daily: [
        { date: '2026-01-13', openai: 12.50, gemini: 5.00, storage: 0.75, total: 18.25 },
        { date: '2026-01-14', openai: 15.75, gemini: 7.00, storage: 0.80, total: 23.55 },
      ],
      byService: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostsPage />);

    await waitFor(() => {
      // Check for chart container or legend
      const dailyTrends = screen.queryAllByText(/Daily Cost Trends/i);
      expect(dailyTrends.length).toBeGreaterThan(0);
    });
  });

  it('displays breakdown by service with operations', async () => {
    const mockCostData = {
      totalCost: 125.50,
      dateRange: { start: '2026-01-13', end: '2026-01-20' },
      breakdown: { openai: 85.25, gemini: 35.00, storage: 5.25 },
      daily: [],
      byService: [
        {
          service: 'openai',
          operations: {
            completion: 45.50,
            tts: 28.00,
            whisper: 11.75
          }
        },
        {
          service: 'gemini',
          operations: {
            image: 35.00
          }
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Breakdown by Service/i)).toBeInTheDocument();
    });

    // Check for service names (multiple occurrences expected)
    const openAiElements = screen.getAllByText(/OpenAI/i);
    expect(openAiElements.length).toBeGreaterThan(0);

    const geminiElements = screen.getAllByText(/Gemini/i);
    expect(geminiElements.length).toBeGreaterThan(0);
  });
});
