export type TrackingType = 'MTM' | 'UTM';

export type LinkValues = { baseUrl: string; trackingType: TrackingType; source: string; medium: string; campaign: string; content: string; term: string; crmCampaign: string; };
export type CampaignValues = { business: string; year: string; region: string; descriptor: string; salesplay: string; language: string; };
export type SurveyValues = { baseUrl: string; lang: string; journey: string; lob: string; campaign: string; medium: string; content: string; };

export function normalizeSegment(value: string) { return String(value || '').trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
export function buildCampaignCode(values: CampaignValues) { return [values.business, values.year, values.region, values.descriptor, values.salesplay, values.language].map(normalizeSegment).filter(Boolean).join('-'); }
export function buildLinkUrl(values: LinkValues) {
  let url: URL;
  try { url = new URL(values.baseUrl.trim()); } catch { return ''; }
  const basePath = url.pathname.replace(/\/+$/g, '');
  url.pathname = `${basePath}/`.replace(/\/{2,}/g, '/'); url.search = ''; url.hash = '';
  const prefix = values.trackingType === 'UTM' ? 'utm' : 'mtm';
  ([[`${prefix}_source`, values.source], [`${prefix}_medium`, values.medium], [`${prefix}_campaign`, values.campaign], [`${prefix}_content`, values.content], [`${prefix}_term`, values.term], ['crm_campaign', values.crmCampaign]] as const).forEach(([key, value]) => { const normalized = value.trim().toUpperCase(); if (normalized) url.searchParams.set(key, normalized); });
  return url.toString();
}
export function buildHighlightUrl(baseGeneratedUrl: string, highlightText: string) { const text = highlightText.trim().replace(/\s+/g, ' '); if (!text) return ''; try { const url = new URL(baseGeneratedUrl); url.hash = ''; return `${url.toString()}#:~:text=${encodeURIComponent(text)}`; } catch { return ''; } }
export function buildSurveyUrl(values: SurveyValues) {
  const baseUrl = values.baseUrl.trim().replace(/[?&]+$/g, ''); if (!baseUrl) return ''; try { new URL(baseUrl); } catch { return ''; }
  const context = { journey: values.journey.trim().toLowerCase(), lob: values.lob.trim(), source: 'CRM', campaign: values.campaign.trim().toLowerCase(), medium: values.medium.trim(), content: values.content.trim().toLowerCase() };
  return `${baseUrl}&lang=${encodeURIComponent(values.lang.trim().toLowerCase())}&ctx=${encodeURIComponent(JSON.stringify(context))}`;
}
