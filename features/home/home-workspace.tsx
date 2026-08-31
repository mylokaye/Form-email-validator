'use client';

import type { NewsResponse } from '@/features/news/news-data';
import { NewsStories } from '@/features/news/news-stories';
import type { RoadmapResponse } from '@/features/home/roadmap-data';
import { RoadmapUpdates } from '@/features/home/roadmap-updates';

export function HomeWorkspace({ initialNews, initialRoadmap }: { initialNews: NewsResponse | null; initialRoadmap: RoadmapResponse | null }) {
  return (
    <div className="flex flex-col gap-6">
      <NewsStories initialData={initialNews} limit={6} sourceFilterLabels={{ 'Microsoft Dynamics': 'Dynamics', Meghan: 'Blogs' }} title="Latest news" showSourceFilter showViewAll />
      <RoadmapUpdates initialData={initialRoadmap} />
    </div>
  );
}
