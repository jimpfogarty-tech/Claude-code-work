# Project: JPF ORBITAL STUDIOS — Game Collection

## Overview
A collection of browser-based retro games deployed to GitHub Pages.
- Live site: https://jimpfogarty-tech.github.io/Claude-code-work/
- Repo: jimpfogarty-tech/Claude-code-work

## Games
- **Fogarty Asteroids** — `asteroids/index.html` (title: "FOGARTY ASTEROIDS")
- **Space Invaders** — `space-invaders/index.html` (title: "Space Invaders by JPF Orbital Studios")

## Project Structure
- `asteroids/index.html` — Asteroids game (single file)
- `space-invaders/index.html` — Space Invaders game (single file)
- `index.html` — root file
- `.github/workflows/` — GitHub Pages deployment workflow

## Development Environment
- The user develops on **iPad using Safari browser** via Claude Code web
- No local dev server available — test by reading code carefully
- Keep each game in a single `index.html` file inside its own directory
- All games must work well on mobile/touch devices (iPad Safari)

## Coding Guidelines
- Always develop on the designated `claude/` feature branch
- Commit and push when changes are complete
- Games are vanilla HTML/CSS/JavaScript — no build tools, no frameworks
- Keep it simple: single-file games, no npm, no dependencies
- Each game lives in its own directory with a single `index.html`

## Deployment
- GitHub Pages deploys from the repo
- Deploys trigger on push to `main` and feature branches
- After merging a PR to `main`, the site updates automatically
