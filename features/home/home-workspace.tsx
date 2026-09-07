'use client';

import type { NewsResponse } from '@/features/news/news-data';
import { NewsStories } from '@/features/news/news-stories';
import type { RoadmapResponse } from '@/features/home/roadmap-data';
import { RoadmapUpdates } from '@/features/home/roadmap-updates';

export function HomeWorkspace({ initialNews, initialRoadmap }: { initialNews: NewsResponse | null; initialRoadmap: RoadmapResponse | null }) {
  return (
    <div className="flex flex-col gap-6">
      <NewsStories initialData={initialNews} limit={6} sourceFilterGroups={[{ id: 'dynamics', label: 'Dynamics', sourceNames: ['Microsoft Dynamics'] }, { id: 'blogs', label: 'Blogs', sourceNames: ['Meghan', 'Amey Holden'] }]} title="Latest news" showSourceFilter />
      <RoadmapUpdates initialData={initialRoadmap} />
    </div>
  );
}
