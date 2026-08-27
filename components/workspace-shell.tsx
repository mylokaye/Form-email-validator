'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, Command, Link2, MessagesSquare, PanelsTopLeft, Rss, Sparkles, Sun, WandSparkles } from 'lucide-react';
import { Button } from './ui/button';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Separator } from './ui/separator';
import { Toaster } from './ui/sonner';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from './shadcn-sidebar/sidebar';
import { TooltipProvider } from './shadcn-sidebar/tooltip';
import { cn } from '../lib/utils';

const tools = [
  { href: '/generate/', label: 'Generate', icon: WandSparkles },
  { href: '/validate/', label: 'Validate', icon: CheckCircle2 },
  { href: '/news/', label: 'News', icon: Rss },
  { href: '/logic/', label: 'Logic', icon: Link2 },
  { href: '/simulation/', label: 'Simulation', icon: MessagesSquare },
  { href: '/studio/', label: 'Studio', icon: PanelsTopLeft },
];

type Appearance = 'light' | 'glass';

const appearanceOptions: { value: Appearance; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Use light theme', icon: Sun },
  { value: 'glass', label: 'Use glass theme', icon: Sparkles },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return <TooltipProvider><SidebarProvider><WorkspaceContent>{children}</WorkspaceContent></SidebarProvider></TooltipProvider>;
}

function WorkspaceContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [appearance, setAppearance] = useState<Appearance>('glass');
  const [commandOpen, setCommandOpen] = useState(false);
  const active = tools.find((tool) => pathname.startsWith(tool.href.slice(0, -1))) ?? tools[0];

  useEffect(() => {
    const stored = localStorage.getItem('pattens.theme.v3');
    const nextAppearance: Appearance = stored === 'glass' || stored === 'light'
      ? stored
      : 'glass';
    applyAppearance(nextAppearance);
  }, []);
  useEffect(() => { void fetch('/api/release-monitor').catch(() => undefined); }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault(); setCommandOpen(true); }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const applyAppearance = (nextAppearance: Appearance) => {
    setAppearance(nextAppearance);
    localStorage.setItem('pattens.theme.v3', nextAppearance);
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.toggle('glass', nextAppearance === 'glass');
  };

  return <>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/generate/" onClick={() => setOpenMobile(false)} />} tooltip="Pattens">
              <img src="/crm-logo.png" alt="" className="size-8 rounded-lg object-contain" />
              <span className="font-semibold tracking-tight">Pattens</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Tools">
              {tools.map(({ href, label, icon: Icon }) => <SidebarMenuItem key={href}><SidebarMenuButton isActive={pathname.startsWith(href.slice(0, -1))} tooltip={label} render={<Link href={href} onClick={() => setOpenMobile(false)} />}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
    <SidebarInset>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2"><SidebarTrigger /><span className="text-sm font-medium md:hidden">Pattens</span></div>
        <div className="flex items-center gap-1"><Button variant="ghost" size="sm" className="border-0 px-3 shadow-none" onClick={() => setCommandOpen(true)} aria-label="Open command menu"><Command className="h-4 w-4" /><span className="hidden sm:inline">Commands</span><kbd className="ml-1 hidden rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">⌘ K</kbd></Button><div className="flex items-center rounded-[10px] border border-border/70 bg-background/60 p-0.5" role="group" aria-label="Appearance">{appearanceOptions.map(({ value, label, icon: Icon }) => <Button key={value} variant="ghost" size="icon" className="rounded-[10px] border-0 shadow-none aria-pressed:bg-background aria-pressed:shadow-sm" onClick={() => applyAppearance(value)} aria-label={label} aria-pressed={appearance === value}><Icon className="h-3.5 w-3.5" /></Button>)}</div></div>
      </header>
      <div className="mx-auto flex w-full max-w-[1600px] flex-1"><div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div></div>
      <footer className="w-full"><Separator /><div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-center px-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8"><p>Copyright 2026</p></div></footer>
    </SidebarInset>
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Command menu" description="Navigate between Pattens tools."><Command><CommandInput placeholder="Search tools..." /><CommandList><CommandEmpty>No matching tool.</CommandEmpty><CommandGroup heading="Go to tool">{tools.map(({ href, label, icon: Icon }) => <CommandItem key={href} value={label} onSelect={() => setCommandOpen(false)}><Link href={href} className="flex w-full items-center gap-3"><Icon className="h-4 w-4" />{label}</Link></CommandItem>)}</CommandGroup></CommandList></Command></CommandDialog>
    <Toaster />
  </>;
}
