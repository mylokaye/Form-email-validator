'use client';

import { useEffect, useState } from 'react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    const observer = new MutationObserver(syncTheme);
    syncTheme();
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <Sonner {...props} theme={theme} position="top-center" duration={2000} closeButton={false} visibleToasts={1} richColors />;
}

export function useErrorNotification(error: string, id: string) {
  useEffect(() => {
    if (error) toast.error(error, { id, duration: 2000 });
    else toast.dismiss(id);
  }, [error, id]);
}
