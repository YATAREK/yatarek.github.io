# yeasintarek.me

Personal research site built with [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/).
Dark mode by default with a light toggle, a blog, and pages for research, publications, and CV.

---

## 1. Preview it on your computer

You need Python 3.9+ installed. In a terminal, from this folder:

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
mkdocs serve
```

Open **http://127.0.0.1:8000** in your browser. The site reloads automatically as you
edit files — leave this running while you work.

## 2. Make it yours

Everything lives in the `docs/` folder as Markdown, plus `mkdocs.yml` for settings.

| What to change | Where |
| --- | --- |
| Your name / site title | `mkdocs.yml` → `site_name` |
| Home page (bio, hero) | `docs/index.md` |
| Research projects | `docs/research.md` |
| Publications | `docs/publications.md` |
| Contact + social links | `docs/contact.md` and `mkdocs.yml` → `extra.social` |
| Your photo | replace `docs/assets/portrait.svg` (use a square image; a `.jpg` is fine — just update the `src` in `index.md`) |
| Colors / fonts | `docs/stylesheets/extra.css` (the clay accent is `--clay`) |

Search the files for `TODO` — those mark every spot meant for your details.

**Writing a blog post:** copy `docs/blog/posts/welcome.md` to a new file in the same
folder, change the `date:` and title, write your post. That's it.

## 3. Put it online (free) at yeasintarek.me

**a. Get the domain.** You mentioned the GitHub Student Pack — claim the free `.me`
domain through the Namecheap (or Name.com) offer in the pack. Otherwise register
`yeasintarek.me` at Cloudflare or Namecheap (~a few dollars/year).

**b. Push to GitHub.**

```bash
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

**c. Turn on Pages.** In your repo: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. The included workflow (`.github/workflows/deploy.yml`) builds
and publishes automatically on every push. First deploy takes a minute or two.

**d. Point the domain.** Two steps:

1. The file `docs/CNAME` already contains `yeasintarek.me`, so GitHub will use it.
2. At your domain registrar, add DNS records pointing to GitHub Pages:
   - Four **A** records for `@` → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - One **CNAME** record for `www` → `<your-username>.github.io`
3. Back in **Settings → Pages**, enter `yeasintarek.me` as the custom domain and tick
   **Enforce HTTPS** once it's available.

After DNS propagates (minutes to a few hours), your site is live at
**https://yeasintarek.me**. From then on, `git push` = publish.

---

## Handy extras (ask if you want these wired up)

- **BibTeX-driven publications** — auto-generate the publications list from a `.bib` file.
- **Jupyter notebooks** — publish worked analyses/plots directly as pages.
- **Analytics** — privacy-friendly visitor stats.
