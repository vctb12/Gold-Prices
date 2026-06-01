# Master Workbook — Session Registry

> Parent: [`docs/GOLD_TICKER_LIVE_MASTER_WORKBOOK.md`](../GOLD_TICKER_LIVE_MASTER_WORKBOOK.md) **v2.0.0**  
> Step-by-step guides: [`APPENDIX_D_SESSION_EXECUTION_GUIDES.md`](./APPENDIX_D_SESSION_EXECUTION_GUIDES.md)  
> Update **one row per PR**. Status: ⬜ queued · 🟡 open · 🟢 merged · 🔴 blocked · ⏭ skipped

## Priority queue (recommended)

| Order | WB ID | Why |
| :---: | ----- | --- |
| 1 | WB-102 | Cross-page glue — highest UX leverage, low risk |
| 2 | WB-101 | GDPR dashboard UX (API may already exist) |
| 3 | WB-501 | Docs archive — reduces agent confusion |
| 4 | WB-201 | SEO noindex stubs — crawl budget |
| 5 | WB-302 | Homepage terminal — product face |

## Registry

| WB ID | Track | Branch | PR | Status | Merged | Guide |
| ----- | ----- | ------ | -- | ------ | ------ | ----- |
| WB-000 | Meta | `cursor/master-workbook-v1-cb21` | [#395](https://github.com/vctb12/GoldTickerLive/pull/395) | 🟡 open | — | Workbook v2 + appendices A–G |
| WB-101 | Integration | `cursor/wb-101-gdpr-export-delete-cb21` | — | ⬜ | — | [D.2](./APPENDIX_D_SESSION_EXECUTION_GUIDES.md#d2-wb-101--gdpr-exportdelete-dashboard-ux) |
| WB-102 | Integration | `cursor/wb-102-cross-page-deeplinks-cb21` | — | 🟡 open | — | [D.1](./APPENDIX_D_SESSION_EXECUTION_GUIDES.md#d1-wb-102--cross-page-deep-links) |
| WB-103 | Integration | `cursor/wb-103-tracker-alerts-ux-cb21` | — | ⬜ | — | — |
| WB-104 | Integration | `cursor/wb-104-dashboard-polish-cb21` | — | ⬜ | — | — |
| WB-105 | Backend | `cursor/wb-105-billing-canonical-cb21` | — | ⬜ | — | NEXT_PR PR4 |
| WB-106 | Backend | `cursor/wb-106-vendor-role-cb21` | — | ⬜ | — | NEXT_PR PR5 |
| WB-201 | SEO | `cursor/wb-201-noindex-stub-plan-cb21` | — | ⬜ | — | [D.3](./APPENDIX_D_SESSION_EXECUTION_GUIDES.md#d3-wb-201--noindex-stub-karat-pages) |
| WB-202 | SEO | `cursor/wb-202-country-canonical-cb21` | — | ⬜ | — | [Appendix G](./APPENDIX_G_COUNTRY_AND_SEO_STRATEGY.md) |
| WB-203 | SEO | `cursor/wb-203-content-schema-cb21` | — | ⬜ | — | — |
| WB-204 | Product | `cursor/wb-204-invest-strategy-cb21` | — | ⬜ | — | — |
| WB-205 | Product | `cursor/wb-205-knowledge-hub-plan-cb21` | — | ⬜ | — | — |
| WB-301 | Product | `cursor/wb-301-shops-build7-cb21` | — | ⬜ | — | [D.4](./APPENDIX_D_SESSION_EXECUTION_GUIDES.md#d4-wb-301--build-7-shops-map) |
| WB-302 | Product | `cursor/wb-302-home-hero-cb21` | — | ⬜ | — | [D.5](./APPENDIX_D_SESSION_EXECUTION_GUIDES.md#d5-wb-302--build-9-homepage-hero) |
| WB-303 | Product | `cursor/wb-303-alerts-server-cb21` | — | ⬜ | — | Appendix F |
| WB-401 | Visual | `cursor/wb-401-nav-terminal-cb21` | — | ⬜ | — | Appendix A |
| WB-402 | Visual | `cursor/wb-402-home-sections-cb21` | — | ⬜ | — | — |
| WB-403 | Visual | `cursor/wb-403-tracker-groups-cb21` | — | ⬜ | — | — |
| WB-404 | Visual | `cursor/wb-404-hover-reveal-cb21` | — | ⬜ | — | — |
| WB-501 | Repo | `cursor/wb-501-docs-archive-cb21` | — | ⬜ | — | [D.6](./APPENDIX_D_SESSION_EXECUTION_GUIDES.md#d6-wb-501--docs-archive-c1a) |
| WB-502 | Repo | `cursor/wb-502-css-colocate-cb21` | — | ⬜ | — | owner |
| WB-503 | Repo | `cursor/wb-503-html-pilot-cb21` | — | ⬜ | — | — |
| WB-504 | Repo | `cursor/wb-504-ci-gates-cb21` | — | ⬜ | — | Appendix B |
| WB-601 | Monetization | `cursor/wb-601-adsense-audit-cb21` | — | ⬜ | — | — |
| WB-602 | Monetization | `cursor/wb-602-ga4-events-cb21` | — | ⬜ | — | — |
| WB-701 | AI | `cursor/wb-701-ai-disclaimers-cb21` | — | ⬜ | — | — |
| WB-801 | Trust | `cursor/wb-801-freshness-sweep-cb21` | — | ⬜ | — | [D.7](./APPENDIX_D_SESSION_EXECUTION_GUIDES.md#d7-wb-801--freshness-label-sweep-) |
| WB-805 | Vendor | `cursor/wb-805-vendor-portal-cb21` | — | ⬜ | — | after WB-106 |
| WB-901 | Tech debt | `cursor/wb-901-hex-tokens-cb21` | — | ⬜ | — | ∞ scanner S9 |

### UI/UX audit (complete — historical)

Sessions 0–5 merged [#387](https://github.com/vctb12/GoldTickerLive/pull/387)–[#393](https://github.com/vctb12/GoldTickerLive/pull/393). See [`UI_UX_AUDIT_SESSION_REGISTRY.md`](../audits/UI_UX_AUDIT_SESSION_REGISTRY.md).

### Endless sessions

Format: `WB-∞-YYYYMMDD-N` — log scanner # from workbook Part 8/20.
