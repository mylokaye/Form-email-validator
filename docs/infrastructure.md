# Pattens infrastructure

**Updated on:** 2026-08-31

This diagram describes the current build and runtime infrastructure. Update both the diagram and the date above whenever a change affects deployment, runtime services, API routes, data stores, secrets, or external integrations.

```mermaid
flowchart TB
  Developer["Developer"]
  GitHub["GitHub repository"]
  Validation["Validation: npm test"]
  Build["Build adapter: npm run build / scripts/build-site.js"]

  Developer --> GitHub
  GitHub --> Validation --> Build

  subgraph Sites["OpenAI Sites deployment"]
    Static["Static Next.js app: HTML, JS, CSS, assets"]
    Worker["Edge Worker: dist/server/index.js"]

    Static -->|same-origin API requests| Worker
  end

  Build --> Static
  Build --> Worker

  Browser["User browser"] -->|HTTPS| Static

  LocalBrowser["Local browser"] --> LocalDev["Next dev server: UI + server-rendered public data"]
  LocalDev -->|development-only server fetch for News and release monitor| Worker
  LocalDev -->|development-only server fetch for roadmap updates| M365RoadmapFeed

  subgraph APIs["Worker API routes"]
    MX["POST /api/mx"]
    URL["POST /api/url-check"]
    News["GET /api/news and /api/news/sources"]
    Monitor["GET /api/release-monitor"]
    Roadmap["GET /api/m365-roadmap"]
    Simulate["POST /api/simulate"]
  end

  Worker --> MX
  Worker --> URL
  Worker --> News
  Worker --> Monitor
  Worker --> Roadmap
  Worker --> Simulate

  MX -->|DNS-over-HTTPS| CloudflareDNS["Cloudflare DNS"]
  URL -->|safe HEAD or limited GET| PublicWeb["Validated public URLs"]
  News --> NewsSources["Configured news sources"]
  NewsSources --> MeghanFeed["Meghan Walker RSS"]
  Monitor --> Microsoft["Microsoft Release Planner JSON"]
  Roadmap --> M365RoadmapFeed["Microsoft 365 Roadmap RSS"]
  Monitor <--> D1["D1: release_monitor_state"]
  Simulate -->|server-side credential| DeepSeek["DeepSeek Chat Completions"]

  Secret["Sites secret: deepseek or DEEPSEEK_API_KEY"] -. available only to .-> Worker
```

## Maintenance rule

When an infrastructure-affecting change is made, update this file in the same change set. This includes changes to the build or hosting flow, Worker endpoints, persistent state, secrets, external services, or browser-to-server request paths. Set **Updated on** to the date of that change.
