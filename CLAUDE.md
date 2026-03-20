# Project: FOGARTY ASTEROIDS

## Overview
A browser-based Asteroids game deployed to GitHub Pages.
- Live site: https://jimpfogarty-tech.github.io/Claude-code-work/
- Repo: jimpfogarty-tech/Claude-code-work

## Project Structure
- `asteroids/index.html` — the game (this is what gets deployed)
- `index.html` — root file (not deployed)
- `.github/workflows/` — GitHub Pages deployment workflow
- Deployment source: the `asteroids/` directory

## Development Environment
- The user develops on **iPad using Safari browser** via Claude Code web
- No local dev server available — test by reading code carefully
- Keep all game code in a single `asteroids/index.html` file for simplicity
- The game must work well on mobile/touch devices (iPad Safari)

## Coding Guidelines
- Always develop on the designated `claude/` feature branch
- Commit and push when changes are complete
- Game is vanilla HTML/CSS/JavaScript — no build tools, no frameworks
- Keep it simple: single-file game, no npm, no dependencies
- Title on start screen should say "FOGARTY ASTEROIDS"

## Deployment
- GitHub Pages deploys from the `asteroids/` directory
- Deploys trigger on push to `main` and feature branches
- After merging a PR to `main`, the site updates automatically
