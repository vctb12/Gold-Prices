# Platform Upgrade Proposal — Full-Stack Revamp (captured 2026-04-22)

```yaml plan-status
status: not-started
priority: P2
class: A
owner: @vctb12
last_run_at: ""
last_run_pr: ""
last_run_agent: copilot
slices_remaining_estimate: 0
next_action: ""
blocked_on: ""
guardrails_reviewed: true
skills_used: []
```

> **Status:** 📥 _Proposal only — not yet reconciled with the master plan._
>
> This file is the **verbatim capture** of the "full platform upgrade" prompt submitted on
> 2026-04-22. It is stored here so it is never lost, but **nothing in this document is authoritative
> on its own**. The single source of truth for what is actually being built, in what order, and with
> what scope is [`docs/REVAMP_PLAN.md`](../REVAMP_PLAN.md).
>
> Before any task from this proposal is executed, it must be:
>
> 1. Reprioritized through [`docs/plans/README.md`](./README.md) (impact × effort matrix).
> 2. Reconciled into the appropriate section of `docs/REVAMP_PLAN.md` (scope, commit bucket,
>    checklist).
> 3. Checked against the scope guard in `AGENTS.md` — architecture changes, directory
>    reorganizations, and new subsystems require explicit owner approval before work starts.
>
> **Do not treat this proposal as a shipping plan.** It is an idea inventory.

---

## Origin

Captured from the "autonomous agent — full platform upgrade" prompt. Intent: a wide-scope
engineering engagement touching repo structure, CI, Python layer, navigation, routing, homepage,
tracker, SEO, admin panel, chatbot, WhatsApp flow, orders, X post generator, charts, and currency
converter.

> **Constraints:** [`AGENTS.md`](../../AGENTS.md) only — anything in the raw proposal below that
> conflicts with those guardrails is downgraded until the owner explicitly approves it.

---

## Raw proposal (verbatim)

> You are GitHub Copilot's autonomous agent operating inside the Gold Ticker Live repository. This
> is a production gold price information website currently deployed at goldtickerlive.com. You have
> full read and write access to the entire codebase and you are authorized to make changes across
> every file in the repo without asking for confirmation unless you are genuinely blocked by a
> missing secret, credential, or external API key that cannot be inferred from the existing
> codebase.
>
> Your job in this session is to execute a full platform upgrade across every dimension of the
> repository. This means the directory structure, the HTML files, the workflows, the Python scripts,
> the admin panel, the navigation, the charts, the live data integrations, the chat system, the
> WhatsApp support flow, the tracker page, the homepage, and every internal redirect and URL. You
> will treat this as a production engineering engagement, not a demo or a prototype. Every function
> you write must be real and testable. Every workflow you create must pass on the first run. Every
> page you touch must be better after you leave it than before you found it.
>
> Start by reading the entire repository. Before you write a single line, map out every file that
> exists, understand what each one does, identify which files are broken or outdated, identify which
> workflows are failing or have failing steps, and identify every dead link, bad redirect, and
> inconsistent URL pattern. Write this audit as an internal markdown file called AGENT_AUDIT.md in
> the repo root, and commit it before doing anything else. This file is your working memory. Update
> it as you progress.
>
> The first structural task is to reorganize the entire repository into a clean, logical directory
> layout. The root should be lean. Static assets go into an assets folder divided into css, js,
> images, icons, and fonts. All Python scripts go into a scripts folder. All GitHub Actions
> workflows stay in dot-github/workflows and every single one must be reviewed and fixed before you
> touch anything else, because broken workflows are the first thing that must be resolved. All HTML
> pages go into a pages folder except for index.html which stays at the root. Any data files, JSON
> feeds, or cached price snapshots go into a data folder. Documentation goes into docs. The admin
> panel gets its own folder called admin. Configuration files like robots.txt, sitemap.xml, CNAME,
> and manifest files stay at the root.
>
> After the structure is clean, fix every GitHub Actions workflow in the repo. Read each YAML file
> line by line. Identify every step that is failing, every deprecated action, every hardcoded path
> that broke after a file moved, every missing secret reference, and every Python dependency that is
> not pinned. Fix all of it. Every workflow must exit with a green check. The gold price posting
> workflow that runs on a schedule and posts to X during UAE market hours is critical and must be
> the first workflow you verify end to end. If there are missing Python packages in
> requirements.txt, add them. If there are environment variables being referenced that are not
> declared, document them clearly in a SECRETS.md file at the repo root listing every secret name,
> what it is used for, and which workflow requires it.
>
> Now address the Python layer. The repo should have a strong Python foundation. Every script that
> fetches gold prices, formats them, writes JSON data files, or handles any data transformation
> should be clean, well-commented Python. Add proper error handling, retry logic with exponential
> backoff, and clear logging to every script. If any script was previously written in JavaScript and
> can be migrated to Python without breaking anything, migrate it. If a script exists only as a
> shell command inside a workflow YAML, extract it into a proper Python file. All Python files
> should follow a consistent style. Add a pyproject.toml or setup.cfg to enforce linting via flake8
> or ruff, and add a pre-commit configuration or a lint workflow that runs on every pull request.
> The goal is for the Python layer to be the backbone of all data operations on this site.
>
> Every pull request to this repo must trigger a code review workflow. Build a GitHub Actions
> workflow called code-review.yml that runs on every pull request and does the following: it lints
> all Python files using ruff or flake8, it validates all HTML files for broken internal links and
> missing meta tags using a Python script you write, it checks that every HTML file has a canonical
> tag, a title, a meta description, and an og:url, it checks that the sitemap.xml contains every
> HTML page in the pages directory, and it posts a summary comment on the pull request listing what
> passed and what needs fixing. If any of these checks fail, the workflow fails the pull request
> check. This creates a quality gate that makes every merge better than the previous state.
>
> The navigation bar must be completely rebuilt and unified across every single page. Right now
> navigation is inconsistent and every page potentially has its own version. Delete all of that.
> Build one single nav component as a standalone HTML partial called nav.html inside a components
> folder, and use a build step or a simple Python script to inject it into every page at build time.
> The nav should be clean, premium, and responsive. It should have the Gold Ticker Live logo on the
> left, main navigation links in the center, and a live gold price ticker or a language toggle or
> both on the right. It should collapse into a clean hamburger menu on mobile with smooth animation.
> It should be identical on every page without exception. The active page should be highlighted.
> Every link in the nav must work correctly after the directory restructure.
>
> All URLs and redirects must be cleaned up. The URL pattern for location-specific pages should
> follow a clear hierarchy such as goldtickerlive.com/uae/sharjah/gold-shops rather than flat
> disorganized paths. Build a redirects map in a file called redirects.json that documents every old
> URL and where it points now, and create a JavaScript redirect handler or a Netlify redirect file
> or a GitHub Pages 404 redirect strategy that handles legacy links gracefully. Every internal link
> across the entire site must be audited and corrected to match the new URL structure.
>
> The homepage must be significantly better. It should load fast, look premium, and immediately
> communicate trust. Above the fold, the user should see the current gold price in AED per gram for
> 24K, 22K, 21K, and 18K displayed as large, clean, live-updating numbers with a freshness label
> showing exactly when the price was last updated. Below that there should be a live sparkline chart
> showing the price movement for the current day. Below that should be a short section explaining
> the difference between spot price and retail price with a clear disclaimer that these are
> reference prices not guaranteed buy or sell prices. Below that should be links to the tracker, the
> order page, the UAE gold shops directory, and the historical charts. The design should use a dark
> theme with gold accents, strong typographic hierarchy, and zero visual clutter. No rotating
> banners. No pop-ups. No fake urgency elements.
>
> The tracker page needs to be completely rebuilt from scratch. The current tracker.html is not
> adequate. The new tracker should be a rich, dynamic, single-page experience. At the top show a
> hero section with the current live price, the daily high and low, the percentage change from
> yesterday, and a confidence or freshness indicator. Below that show a full-width interactive price
> chart with multiple timeframe options: 1 day, 1 week, 1 month, 3 months, 6 months, 1 year, and all
> time. The chart must be built with Chart.js or Recharts or a comparable library and must support
> zoom, hover tooltips showing exact price and timestamp, and the ability to toggle between line
> chart, candlestick, and area chart views. Below the main chart show a breakdown by karat with
> individual sparklines for 24K, 22K, 21K, and 18K. Show a comparison panel that lets the user
> compare gold prices against USD, EUR, and other major currencies. Show a price alert section where
> users can set a target price and get notified when gold hits it. Show a historical data table
> below the chart that is paginated, sortable, and downloadable as CSV. This is the page users will
> spend the most time on and it must reflect that.
>
> Every HTML page in the repo must be reviewed and enhanced. Each page needs proper semantic HTML
> structure, a unique title tag, a well-written meta description, a canonical URL, Open Graph tags
> with a proper og:url reflecting the new domain, structured data schema markup appropriate to the
> page content, and a correct entry in the sitemap. Pages showing gold prices should use the
> FinancialProduct or PriceSpecification schema. Location pages should use LocalBusiness schema. The
> tracker should use Dataset or FinancialQuote schema. Write a Python script called validate_seo.py
> in the scripts folder that scans every HTML file and outputs a report of missing or malformed SEO
> elements.
>
> The admin panel must be fully functional, not a placeholder. Build it inside the admin folder. It
> should require authentication via a simple password gate using a hashed token stored as a GitHub
> Secret or a hardcoded bcrypt hash in a config file, since this is a static site. Once
> authenticated, the admin should be able to do the following things. They should be able to add,
> edit, and remove gold shop listings in the UAE shops directory and have those changes reflected on
> the live site either via a JSON data file that the frontend reads or via a GitHub Actions workflow
> that commits the updated data. They should be able to write and publish announcements or notices
> that appear as a banner on the homepage. They should be able to trigger a manual price refresh.
> They should be able to view a dashboard showing the last 24 hours of price fetch history, how many
> times each workflow ran, and whether any failed. They should be able to create GitHub Issues
> directly from the admin panel by filling out a form that sends a request to the GitHub API with a
> structured issue title and body, allowing bugs and site problems to be tracked properly in the
> repo's issue tracker. The admin panel should also show a basic analytics summary pulled from
> Google Analytics or pulled from a lightweight tracking script embedded in the site.
>
> The chatbot on the website should not be a static FAQ widget. Build a chatbot component that can
> be embedded on any page via a floating button. The chatbot should have a set of predefined quick
> reply buttons covering common questions like what is the current gold price, what is the
> difference between 21K and 24K gold, how do I place an order, where are gold shops near me, and
> what are today's rates in AED. When a user clicks a quick reply, the bot responds with a dynamic
> answer that pulls from the current data state of the site, meaning if someone asks for the current
> price the bot reads the latest price from the data file and replies with it. When a user types a
> custom message, the bot uses a pattern matching approach or a simple keyword detection script to
> route to the best predefined response, and if no match is found it offers to connect them via
> WhatsApp. The quick reply options should update after each response to guide the user toward the
> next logical question. This is not a large language model chatbot, it is a well-designed guided
> conversation flow that feels smart because it is data-aware.
>
> WhatsApp support should be integrated properly. Add a floating WhatsApp button to every page that
> opens a pre-filled WhatsApp message with the user's current page URL and a default message like I
> have a question about gold prices. In the chatbot, when the conversation reaches a dead end or the
> user asks something outside the predefined flow, offer a WhatsApp handoff button. On the order
> page, the primary contact method for completing an order should be WhatsApp with a pre-filled
> message that includes the order details. Store the WhatsApp number in a single config file so it
> can be changed in one place and reflected everywhere.
>
> The gold ordering system must work end to end. Build a clean order page at a URL like
> goldtickerlive.com/order. The page should let the user select a karat from 24K, 22K, 21K, and 18K,
> select a weight from standard sizes like 1 gram, 5 grams, 10 grams, 20 grams, 50 grams, and 100
> grams, and see a live price estimate calculated from the current spot price with a clearly labeled
> markup or premium percentage. The order is not processed through a payment gateway on the site
> itself. Instead, when the user clicks submit, they are directed to WhatsApp with all their order
> details pre-filled in the message. The page should be honest and clear that the final price is
> confirmed at time of fulfillment and that the displayed price is an estimate based on the current
> spot rate.
>
> The X post generator page should produce consistently branded, visually clean posts. When the user
> opens the page they should see a live preview of what the post will look like when published. The
> post format should show the current prices for all four karats in AED per gram, a clean timestamp,
> a short tagline, and the goldtickerlive.com link at the bottom. The user should be able to copy
> the post text with one click and open it directly in X's compose window with the text pre-filled
> using the web intent URL. The post format must be consistent every time so that the account builds
> a recognizable visual signature over time. Optionally generate a PNG image card showing the price
> table in a branded design that can be attached to the tweet for higher engagement.
>
> Every chart on the site must be live, beautiful, and interactive. Use Chart.js as the primary
> charting library and load it from a CDN. All charts should use the dark theme matching the site
> design, with gold as the primary accent color. Every chart should have hover tooltips, smooth
> transitions on data load, and a no-data state that shows a loading skeleton instead of a blank
> space. Historical charts must fetch from a data file maintained by the Python scripts that store
> hourly snapshots. The tracker page is the main chart showcase but charts should also appear as
> smaller sparklines on the homepage, the karat detail pages, and the order page to show recent
> price movement.
>
> The site should also include a currency converter widget that lets users convert between AED and
> major currencies using the current gold price as the base. It should update automatically when the
> gold price updates.
>
> As you work through all of this, maintain a clean Git history. Each logical unit of work should be
> a separate commit with a clear commit message. Use conventional commit format where possible such
> as feat, fix, refactor, chore, and docs prefixes. When you encounter something that is a known
> limitation, a design decision that needs input, or a task that requires an external credential you
> do not have, open a GitHub Issue using the GitHub API documenting exactly what is needed, why it
> is blocked, and what the next step is. Do not leave TODO comments scattered in the code. Either
> implement the thing or open an issue for it.
>
> When you are done with the full upgrade, write a file called UPGRADE_SUMMARY.md at the repo root
> that lists every change made organized by category, every workflow status, every new feature
> added, every file that was deleted, renamed, or moved, every issue opened, and every dependency
> added. This becomes the handoff document.
>
> Your standard of quality throughout this entire engagement is: would a senior engineer at a
> fintech company be comfortable with this code in production? If the answer is no for anything you
> produce, rework it until the answer is yes.

---

## Reconciliation checklist (owner action required)

Before any of this is executed, the owner must decide, per item in
[`docs/plans/README.md`](./README.md):

- [ ] Approved — reconciled into `REVAMP_PLAN.md` section: **\_\_\_**
- [ ] Deferred — parked with rationale
- [ ] Rejected — conflicts with product priorities or architecture guardrails

Items still pending reconciliation must not be executed. See the priority matrix in
[`docs/plans/README.md`](./README.md) for the recommended order of reconciliation.
