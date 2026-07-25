'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Command, GitBranch, Link2, MessagesSquare, Moon, Sun, WandSparkles } from 'lucide-react';
import { Button } from './ui/button';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';

const tools = [
  { href: '/generate/', label: 'Generate', icon: WandSparkles },
  { href: '/convert/', label: 'Convert', icon: GitBranch },
  { href: '/validate/', label: 'Validate', icon: CheckCircle2 },
  { href: '/logic/', label: 'Logic', icon: Link2 },
  { href: '/simulation/', label: 'Simulation', icon: MessagesSquare },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const active = tools.find((tool) => pathname.startsWith(tool.href.slice(0, -1))) ?? tools[0];

  useEffect(() => {
    const stored = localStorage.getItem('pattens.theme.v2');
    const nextDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault(); setCommandOpen(true); }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const toggleTheme = () => { const next = !dark; setDark(next); localStorage.setItem('pattens.theme.v2', next ? 'dark' : 'light'); document.documentElement.classList.toggle('dark', next); };

  return <div className="flex min-h-screen flex-col bg-background">
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3"><img src="/crm-logo.png" alt="Pattens" className="h-8 w-8 rounded-lg object-contain" /><span className="text-sm font-semibold tracking-tight">Pattens</span></div>
      <div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => setCommandOpen(true)} aria-label="Open command menu"><Command className="h-4 w-4" /><span className="hidden sm:inline">Commands</span><kbd className="ml-1 hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">⌘ K</kbd></Button><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={dark ? 'Use light theme' : 'Use dark theme'}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button></div>
    </header>
    <div className="mx-auto flex w-full max-w-[1600px] flex-1">
      <aside className="hidden w-60 shrink-0 border-r border-border px-3 py-5 md:block"><nav className="space-y-1" aria-label="Tools">{tools.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors', pathname.startsWith(href.slice(0, -1)) ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}><Icon className="h-4 w-4" /><span>{label}</span></Link>)}</nav></aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"><span>Workspace</span><ChevronDown className="h-3 w-3" /><span className="text-foreground">{active.label}</span></div>{children}</main>
    </div>
    <footer className="w-full"><Separator /><div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-center px-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8"><p>Copyright 2026</p></div></footer>
    <nav className="sticky bottom-0 flex overflow-x-auto border-t border-border bg-background p-2 md:hidden" aria-label="Tools">{tools.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn('flex min-w-24 flex-1 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs', pathname.startsWith(href.slice(0, -1)) ? 'bg-accent text-foreground' : 'text-muted-foreground')}><Icon className="h-4 w-4" />{label}</Link>)}</nav>
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Command menu" description="Navigate between Pattens tools."><Command><CommandInput placeholder="Search tools..." /><CommandList><CommandEmpty>No matching tool.</CommandEmpty><CommandGroup heading="Go to tool">{tools.map(({ href, label, icon: Icon }) => <CommandItem key={href} value={label} onSelect={() => setCommandOpen(false)}><Link href={href} className="flex w-full items-center gap-3"><Icon className="h-4 w-4" />{label}</Link></CommandItem>)}</CommandGroup></CommandList></Command></CommandDialog>
  </div>;
}
