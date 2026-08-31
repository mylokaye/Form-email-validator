import { HomeWorkspace } from '@/features/home/home-workspace';
import { getDevelopmentNewsData } from '@/features/news/news-data';
import { getDevelopmentRoadmapData } from '@/features/home/roadmap-data';

export default async function HomePage() {
  const [initialNews, initialRoadmap] = await Promise.all([getDevelopmentNewsData(), getDevelopmentRoadmapData()]);
  return <HomeWorkspace initialNews={initialNews} initialRoadmap={initialRoadmap} />;
}
