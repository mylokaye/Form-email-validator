import { NewsWorkspace } from '@/features/news/news-workspace';
import { getDevelopmentNewsData } from '@/features/news/news-data';
import { getDevelopmentReleaseMonitorData } from '@/features/news/release-monitor-data';

export default async function NewsPage() {
  const [initialNews, initialMonitor] = await Promise.all([getDevelopmentNewsData(), getDevelopmentReleaseMonitorData()]);
  return <NewsWorkspace initialNews={initialNews} initialMonitor={initialMonitor} />;
}
