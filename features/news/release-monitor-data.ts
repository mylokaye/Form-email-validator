export type MonitorItem = { id: string; title: string; area: string; sourceUrl: string; previewDate: string; gaDate: string; previewStatus: string; gaStatus: string; lastUpdatedAt: number | null; change: { summary: string; detectedAt: number } | null };
export type MonitorResponse = { sourceUrl: string; columns: { generalAvailability: MonitorItem[]; publicPreview: MonitorItem[]; planned: MonitorItem[] }; changes: { featureId: string; summary: string; detectedAt: number }[]; checkedAt: number | null; lastError: string | null };

const upstreamOrigin = (process.env.PATTENS_LOCAL_API_ORIGIN || 'https://pattens.tech').replace(/\/$/, '');

export async function getDevelopmentReleaseMonitorData(): Promise<MonitorResponse | null> {
  if (process.env.NODE_ENV !== 'development') return null;

  try {
    const response = await fetch(`${upstreamOrigin}/api/release-monitor`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json() as MonitorResponse;
  } catch {
    return null;
  }
}
