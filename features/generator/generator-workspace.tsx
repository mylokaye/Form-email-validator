"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Link2, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { FloatingField as Field } from "../../components/ui/floating-field";
import {
  buildCampaignCode,
  buildHighlightUrl,
  buildLinkUrl,
  buildSurveyUrl,
  isDynamicsUrl,
  type CampaignValues,
  type LinkValues,
  type SurveyValues,
  type TrackingType,
} from "./core";

const emptyLink: LinkValues = {
  baseUrl: "http://google.com",
  trackingTypes: ["MTM"],
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
  dynamicsNoCache: false,
  simple: false,
};
const emptyCampaign: CampaignValues = {
  business: "",
  year: "",
  region: "",
  descriptor: "",
  salesplay: "",
  language: "",
};
const emptySurvey: SurveyValues = {
  baseUrl: "",
  lang: "en-us",
  journey: "",
  lob: "",
  campaign: "",
  medium: "",
  content: "",
};

export function GeneratorWorkspace() {
  const [mode, setMode] = useState<"link" | "campaign" | "survey">("link");
  const [link, setLink] = useState(emptyLink);
  const [campaign, setCampaign] = useState(emptyCampaign);
  const [survey, setSurvey] = useState(emptySurvey);
  const [highlight, setHighlight] = useState("");
  const [copied, setCopied] = useState(false);
  const [urlValidation, setUrlValidation] = useState<"idle" | "loading" | "success" | "error">("idle");
  const urlValidationRequest = useRef(0);
  const dynamicsDetected = isDynamicsUrl(link.baseUrl);
  const output = useMemo(
    () =>
      mode === "link"
        ? highlight
          ? buildHighlightUrl(buildLinkUrl(link), highlight)
          : buildLinkUrl(link)
        : mode === "campaign"
          ? buildCampaignCode(campaign)
          : buildSurveyUrl(survey),
    [mode, link, campaign, survey, highlight],
  );
  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      const input = document.createElement("textarea");
      input.value = output;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const reset = () => {
    if (mode === "link") {
      setLink(emptyLink);
      setHighlight("");
    }
    if (mode === "campaign") setCampaign(emptyCampaign);
    if (mode === "survey") setSurvey(emptySurvey);
  };
  const linkSet = (key: Exclude<keyof LinkValues, "trackingTypes" | "dynamicsNoCache" | "simple">, value: string) =>
    setLink((current) => ({ ...current, [key]: value }));
  const toggleTrackingType = (type: TrackingType) =>
    setLink((current) => {
      const selected = current.trackingTypes.includes(type);
      if (selected && current.trackingTypes.length === 1) return current;
      return { ...current, trackingTypes: selected ? current.trackingTypes.filter((candidate) => candidate !== type) : [...current.trackingTypes, type] };
    });
  const setLinkUrl = (value: string) => {
    urlValidationRequest.current += 1;
    setUrlValidation("idle");
    setLink((current) => ({ ...current, baseUrl: value, dynamicsNoCache: isDynamicsUrl(value) ? current.dynamicsNoCache : false }));
  };
  const validateUrl = async () => {
    const requestId = urlValidationRequest.current + 1;
    urlValidationRequest.current = requestId;
    setUrlValidation("loading");
    try {
      const response = await fetch("/api/url-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link.baseUrl }),
      });
      const payload = (await response.json()) as { valid?: boolean };
      if (urlValidationRequest.current === requestId) setUrlValidation(response.ok && payload.valid ? "success" : "error");
    } catch {
      if (urlValidationRequest.current === requestId) setUrlValidation("error");
    }
  };
  const campaignSet = (key: keyof CampaignValues, value: string) =>
    setCampaign((current) => ({ ...current, [key]: value }));
  const surveySet = (key: keyof SurveyValues, value: string) =>
    setSurvey((current) => ({ ...current, [key]: value }));
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader className="border-b"><CardTitle>Generate</CardTitle><div
              className="flex flex-wrap gap-2 sm:col-span-2"
              role="tablist"
              aria-label="Generator type"
            >
              {(["link", "campaign", "survey"] as const).map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={mode === item ? "default" : "secondary"}
                  size="sm"
                  role="tab"
                  aria-selected={mode === item}
                  onClick={() => setMode(item)}
                  className="h-8 px-3"
                >
                  {item === "link"
                    ? "URL"
                    : item === "campaign"
                      ? "Campaign"
                      : "Survey"}
                </Button>
              ))}
            </div></CardHeader>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
            {mode === "link" && (
              <>
                <div className="sm:col-span-2 space-y-2">
                  <Field
                    label="URL"
                    value={link.baseUrl}
                    onChange={setLinkUrl}
                  />
                </div>
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                  <Field
                    label="Source"
                    value={link.source}
                    onChange={(value) => linkSet("source", value)}
                  />
                  <Field
                    label="Medium"
                    value={link.medium}
                    onChange={(value) => linkSet("medium", value)}
                  />
                  <Field
                    label="Content"
                    value={link.content}
                    onChange={(value) => linkSet("content", value)}
                  />
                </div>
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                  <Field
                    label="Campaign"
                    value={link.campaign}
                    onChange={(value) => linkSet("campaign", value)}
                  />
                  <Field
                    label="Term"
                    value={link.term}
                    onChange={(value) => linkSet("term", value)}
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  {(["MTM", "UTM"] as TrackingType[]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={
                        link.trackingTypes.includes(type) ? "default" : "secondary"
                      }
                      onClick={() => toggleTrackingType(type)}
                      aria-pressed={link.trackingTypes.includes(type)}
                    >
                      {type}
                    </Button>
                  ))}
                  <span className="flex-1" aria-hidden="true" />
                  <Button
                    type="button"
                    size="sm"
                    variant={link.simple ? "default" : "secondary"}
                    onClick={() => setLink((current) => ({ ...current, simple: !current.simple }))}
                    aria-pressed={link.simple}
                  >
                    Simple
                  </Button>
                  {dynamicsDetected && (
                    <Button
                      type="button"
                      size="sm"
                      variant={link.dynamicsNoCache ? "default" : "secondary"}
                      onClick={() => setLink((current) => ({ ...current, dynamicsNoCache: !current.dynamicsNoCache }))}
                      aria-pressed={link.dynamicsNoCache}
                    >
                      Cache
                    </Button>
                  )}
                </div>
              </>
            )}
            {mode === "campaign" && (
              <>
                <Field
                  label="Business"
                  value={campaign.business}
                  onChange={(value) => campaignSet("business", value)}
                />
                <Field
                  label="Year"
                  value={campaign.year}
                  onChange={(value) => campaignSet("year", value)}
                />
                <Field
                  label="Region"
                  value={campaign.region}
                  onChange={(value) => campaignSet("region", value)}
                />
                <Field
                  label="Descriptor"
                  value={campaign.descriptor}
                  onChange={(value) => campaignSet("descriptor", value)}
                />
                <Field
                  label="Sales play"
                  value={campaign.salesplay}
                  onChange={(value) => campaignSet("salesplay", value)}
                />
                <Field
                  label="Language"
                  value={campaign.language}
                  onChange={(value) => campaignSet("language", value)}
                />
              </>
            )}
            {mode === "survey" && (
              <>
                <div className="sm:col-span-2">
                  <Field
                    label="URL"
                    value={survey.baseUrl}
                    onChange={(value) => surveySet("baseUrl", value)}
                  />
                </div>
                <Field
                  label="Language"
                  value={survey.lang}
                  onChange={(value) => surveySet("lang", value)}
                />
                <Field
                  label="Journey"
                  value={survey.journey}
                  onChange={(value) => surveySet("journey", value)}
                />
                <Field
                  label="Line of business"
                  value={survey.lob}
                  onChange={(value) => surveySet("lob", value)}
                />
                <Field
                  label="Campaign"
                  value={survey.campaign}
                  onChange={(value) => surveySet("campaign", value)}
                />
                <Field
                  label="Medium"
                  value={survey.medium}
                  onChange={(value) => surveySet("medium", value)}
                />
                <Field
                  label="Content"
                  value={survey.content}
                  onChange={(value) => surveySet("content", value)}
                />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b"><CardTitle>Output</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <output
              className="block min-h-28 break-all rounded-lg border border-dashed border-border bg-secondary/40 p-3 font-mono text-xs leading-5"
              aria-live="polite"
            >
              {output}
            </output>
            <div className="mt-4 flex flex-wrap gap-2">
              {mode === "link" && <Button type="button" variant="secondary" onClick={() => void validateUrl()} disabled={urlValidation === "loading"}>
                {urlValidation === "loading" ? "Validating…" : "Validate"}
              </Button>}
              <Button onClick={copy} disabled={!output}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              {mode === "link" && output && (
                <a
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-[10px] bg-secondary px-3 text-[13px] leading-4 font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                  href={output}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              )}
              <Button variant="ghost" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
              {urlValidation === "success" && <p className="inline-flex h-8 items-center gap-1.5 text-sm font-medium text-emerald-700" role="status"><Check className="h-4 w-4" />URL validated</p>}
              {urlValidation === "error" && <p className="flex h-8 items-center text-sm text-destructive" role="alert">Could not validate this URL.</p>}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
