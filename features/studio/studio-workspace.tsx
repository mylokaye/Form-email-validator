'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Ratio = '16:9' | '1:1' | '4:5' | '9:16';
type Fit = 'contain' | 'cover';
type Preset = 'hero' | 'angled' | 'custom';
type StudioSettings = {
  ratio: Ratio;
  fit: Fit;
  preset: Preset;
  padding: number;
  radius: number;
  panX: number;
  panY: number;
  tiltX: number;
  tiltY: number;
  roll: number;
  fov: number;
  startColor: string;
  endColor: string;
};

const storageKey = 'pattens.studio.settings.v1';
const imageStorageKey = 'pattens.studio.image.v1';
const heroPreset = {
  tiltX: 0,
  tiltY: 0,
  roll: 0,
  fov: 45,
  panX: 0,
  panY: 0,
};
const angledPreset = {
  tiltX: -12,
  tiltY: -13,
  roll: -3,
  fov: 20,
  panX: 0.37,
  panY: -0.15,
};
const defaults: StudioSettings = {
  ratio: '16:9',
  fit: 'contain',
  preset: 'hero',
  padding: 24,
  radius: 45,
  ...heroPreset,
  startColor: '#0277FC',
  endColor: '#002D75',
};

const ratios: Record<Ratio, number> = { '16:9': 16 / 9, '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16 };

function savedSettings(): StudioSettings {
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return { ...defaults, ...stored };
  } catch {
    return defaults;
  }
}

function drawBrowserCanvas(image: HTMLImageElement | null, settings: StudioSettings) {
  const width = 1600;
  const height = Math.round(width / ratios[settings.ratio]);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const frameRadius = Math.min(settings.radius, width / 8, height / 8);
  context.save();
  roundedRect(context, 0, 0, width, height, frameRadius);
  context.fillStyle = '#ffffff';
  context.fill();
  roundedRect(context, 0, 0, width, height, frameRadius);
  context.clip();
  const availableX = 0;
  const availableY = 72;
  const availableWidth = width;
  const availableHeight = height - 72;
  if (image) {
    const sourceRatio = image.width / image.height;
    const availableRatio = availableWidth / availableHeight;
    const useWidth = settings.fit === 'contain' ? sourceRatio > availableRatio : sourceRatio < availableRatio;
    let drawWidth = useWidth ? availableWidth : availableHeight * sourceRatio;
    let drawHeight = useWidth ? availableWidth / sourceRatio : availableHeight;
    const drawX = availableX + (availableWidth - drawWidth) / 2;
    const drawY = availableY + (availableHeight - drawHeight) / 2;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  } else {
    context.fillStyle = '#f8fafc';
    context.fillRect(availableX, availableY, availableWidth, availableHeight);
  }
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, width, 72);
  context.fillStyle = '#e2e8f0';
  [0, 1, 2].forEach((index) => {
    context.beginPath();
    context.arc(36 + index * 22, 36, 7, 0, Math.PI * 2);
    context.fill();
  });
  roundedRect(context, 132, 20, width - 168, 32, 16);
  context.fill();
  context.restore();
  return canvas;
}

function drawGradientCanvas(settings: StudioSettings) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, settings.startColor);
  gradient.addColorStop(1, settings.endColor);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      const mapped = material as THREE.MeshStandardMaterial;
      mapped.map?.dispose();
      material.dispose();
    });
  });
}

function renderWebGLScene(renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement, image: HTMLImageElement | null, settings: StudioSettings, multiplier = 1) {
  const width = 1600 * multiplier;
  const height = Math.round(width / ratios[settings.ratio]);
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fov, width / height, 0.1, 100);
  const browserTexture = new THREE.CanvasTexture(drawBrowserCanvas(image, settings));
  browserTexture.colorSpace = THREE.SRGBColorSpace;
  browserTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const browserHeight = 6;
  const browserWidth = browserHeight * ratios[settings.ratio];
  const sideMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const frontMaterial = new THREE.MeshBasicMaterial({ map: browserTexture, transparent: true, alphaTest: 0.01 });
  const browser = new THREE.Mesh(
    new THREE.BoxGeometry(browserWidth, browserHeight, 0.12),
    [sideMaterial, sideMaterial.clone(), sideMaterial.clone(), sideMaterial.clone(), frontMaterial, sideMaterial.clone()],
  );
  browser.rotation.set(
    THREE.MathUtils.degToRad(settings.tiltX),
    THREE.MathUtils.degToRad(settings.tiltY),
    THREE.MathUtils.degToRad(settings.roll),
  );
  scene.add(browser);

  const backgroundTexture = new THREE.CanvasTexture(drawGradientCanvas(settings));
  backgroundTexture.colorSpace = THREE.SRGBColorSpace;
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(80 * ratios[settings.ratio], 80),
    new THREE.MeshBasicMaterial({ map: backgroundTexture, depthWrite: false }),
  );
  backdrop.position.z = -8;
  scene.add(backdrop);

  camera.position.set(settings.panX, -settings.panY, 8);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  disposeScene(scene);
}

export function StudioWorkspace() {
  const [settings, setSettings] = useState<StudioSettings>(defaults);
  const [source, setSource] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    setSettings(savedSettings());
    try { setSource(sessionStorage.getItem(imageStorageKey) ?? ''); } catch { /* Storage is optional. */ }
  }, []);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    return () => { renderer.dispose(); rendererRef.current = null; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    if (!source) {
      imageRef.current = null;
      renderWebGLScene(renderer, canvas, null, settings);
      return;
    }
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      renderWebGLScene(renderer, canvas, image, settings);
    };
    image.src = source;
  }, [settings, source]);

  const update = <Key extends keyof StudioSettings>(key: Key, value: StudioSettings[Key]) => setSettings((current) => ({ ...current, [key]: value, ...(['tiltX', 'tiltY', 'roll', 'fov', 'panX', 'panY'].includes(key) ? { preset: 'custom' as Preset } : {}) }));
  const applyPreset = (preset: Preset) => setSettings((current) => preset === 'hero' ? { ...current, ...heroPreset, preset } : preset === 'angled' ? { ...current, ...angledPreset, preset } : { ...current, preset });
  const loadFile = (file: Blob | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const next = String(reader.result ?? '');
      setSource(next);
      setSettings((current) => ({ ...current, ...heroPreset, preset: 'hero' }));
      try { sessionStorage.setItem(imageStorageKey, next); } catch {}
    };
    reader.readAsDataURL(file);
  };
  const onUpload = (event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0]);
  const reset = () => { setSettings(defaults); };
  const download = (multiplier: number) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    renderWebGLScene(renderer, canvas, imageRef.current, settings, multiplier);
    const link = document.createElement('a');
    link.download = `pattens-studio-${settings.ratio.replace(':', 'x')}-${multiplier}x.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    renderWebGLScene(renderer, canvas, imageRef.current, settings);
  };

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-start">
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Controls</CardTitle>
        <Button type="button" size="sm" className="h-8 px-2" onClick={() => inputRef.current?.click()}>
          <Upload data-icon="inline-start" />Upload
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onUpload} />
        <div>
          <ToggleGroup
            aria-label="Preset"
            value={[settings.preset]}
            onValueChange={(values) => { if (values[0]) applyPreset(values[0] as Preset); }}
            variant="outline"
            size="lg"
            className="grid w-full grid-cols-3"
          >
            <ToggleGroupItem value="hero" className="h-8 w-full">Hero</ToggleGroupItem>
            <ToggleGroupItem value="angled" className="h-8 w-full">Angled</ToggleGroupItem>
            <ToggleGroupItem value="custom" className="h-8 w-full">Custom</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="grid gap-4">
          <div>
            <ToggleGroup
              aria-label="Ratio"
              value={[settings.ratio]}
              onValueChange={(values) => { if (values[0]) update('ratio', values[0] as Ratio); }}
              variant="outline"
              size="lg"
              className="grid w-full grid-cols-4"
            >
              <ToggleGroupItem value="16:9" className="h-8 w-full">16:9</ToggleGroupItem>
              <ToggleGroupItem value="1:1" className="h-8 w-full">1:1</ToggleGroupItem>
              <ToggleGroupItem value="4:5" className="h-8 w-full">4:5</ToggleGroupItem>
              <ToggleGroupItem value="9:16" className="h-8 w-full">9:16</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div>
            <ToggleGroup
              aria-label="Image fit"
              value={[settings.fit]}
              onValueChange={(values) => { if (values[0]) update('fit', values[0] as Fit); }}
              variant="outline"
              size="lg"
              className="grid w-full grid-cols-2"
            >
              <ToggleGroupItem value="contain" className="h-8 w-full">Fit</ToggleGroupItem>
              <ToggleGroupItem value="cover" className="h-8 w-full">Fill</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <div className="grid gap-3">
          <CameraControl stacked label="Object X" value={settings.tiltX} min={-70} max={70} format={(value) => value.toFixed(0)} onChange={(value) => update('tiltX', value)} />
          <CameraControl stacked label="Object Y" value={settings.tiltY} min={-60} max={60} format={(value) => value.toFixed(0)} onChange={(value) => update('tiltY', value)} />
          <CameraControl stacked label="Roll" value={settings.roll} min={-180} max={180} format={(value) => value.toFixed(0)} onChange={(value) => update('roll', value)} />
          <CameraControl stacked label="FOV" value={settings.fov} min={10} max={100} format={(value) => value.toFixed(0)} onChange={(value) => update('fov', value)} />
        </div>
        <Accordion>
          <AccordionItem value="advanced" className="not-last:border-b-0">
            <AccordionTrigger className="!border-0">Advanced</AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="grid gap-3">
                <CameraControl label="Pan X" value={settings.panX} min={-3} max={3} step={0.01} format={(value) => value.toFixed(2)} onChange={(value) => update('panX', value)} />
                <CameraControl label="Pan Y" value={settings.panY} min={-3} max={3} step={0.01} format={(value) => value.toFixed(2)} onChange={(value) => update('panY', value)} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ControlRange label="Padding" value={settings.padding} min={24} max={160} suffix="px" onChange={(value) => update('padding', value)} />
                <ControlRange label="Corners" value={settings.radius} min={0} max={64} suffix="px" onChange={(value) => update('radius', value)} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ColorControl label="Gradient start" value={settings.startColor} onChange={(value) => update('startColor', value)} />
                <ColorControl label="Gradient end" value={settings.endColor} onChange={(value) => update('endColor', value)} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Button type="button" variant="secondary" onClick={reset}><RotateCcw data-icon="inline-start" />Reset</Button>
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Preview</CardTitle>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((multiplier) => <Button key={multiplier} type="button" size="sm" className="h-8 px-2" onClick={() => download(multiplier)} disabled={!source}><Download data-icon="inline-start" />{multiplier}x PNG</Button>)}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        <div className="overflow-hidden rounded-lg border border-border bg-secondary/20">
          <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Studio mockup preview" />
        </div>
      </CardContent>
    </Card>
  </div>;
}

function ControlRange({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="grid gap-2 text-sm font-medium"><span className="flex items-center justify-between gap-2"><span>{label}</span><span className="text-xs font-normal text-muted-foreground">{value}{suffix}</span></span><input className="h-[50px] w-full cursor-ew-resize accent-primary" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function CameraControl({ label, value, min, max, step = 1, format, onChange, stacked = false }: { label: string; value: number; min: number; max: number; step?: number; format: (value: number) => string; onChange: (value: number) => void; stacked?: boolean }) {
  const slider = <input className="h-[50px] w-full cursor-ew-resize accent-primary" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />;
  if (stacked) return <label className="grid gap-0 text-sm font-medium"><span className="flex items-center justify-between gap-2"><span>{label}</span><output className="font-mono text-xs font-normal text-muted-foreground">{format(value)}</output></span>{slider}</label>;
  return <label className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)_3.75rem] items-center gap-2"><span className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.14em]">{label}</span>{slider}<output className="flex h-[50px] items-center justify-end rounded-lg bg-secondary/60 px-2 font-mono text-sm text-muted-foreground">{format(value)}</output></label>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span><span className="flex h-[50px] items-center gap-3 rounded-lg border border-input bg-background px-3"><input className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" type="color" value={value} onChange={(event) => onChange(event.target.value)} /><span className="font-mono text-xs text-muted-foreground">{value.toUpperCase()}</span></span></label>;
}
