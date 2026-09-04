# Contributing Guide & Engineering Standards — Pet Boss Clinic

> **Code Quality, Architectural Standards & Pull Request Conventions**  
> Guidelines for internal developers, designers, and contributors working on the Pet Boss Clinic codebase.

---

## 1. Core Engineering Principles

1. **Strict TypeScript:** No `any` types without explicit senior approval. Interfaces and types must be exported cleanly from `/types` or co-located with components.
2. **Bilingual By Design:** Every user-facing UI component must support both Farsi (RTL, Vazirmatn) and English (LTR, Outfit). Never hardcode English or Persian strings in layout files without internationalization wrapper or fallback.
3. **Luxury Design System Adherence:**
   - Always reference design tokens (`--luxury-charcoal`, `--luxury-gold`, `--luxury-surface-dark`) defined in `styles/tokens.css`.
   - Never introduce unapproved ad-hoc neon or primary colors.
   - Use `<LuxuryPillBadge />` for tags, badges, and operational status labels.
   - Use `<PetBossLogo />` for all brand header and footer instances.
4. **Clean Git Hygiene:** Never commit `.env` secrets, database connection URLs, scratch scripts, or un-minified assets.

---

## 2. Development Workflow

### 2.1 Branching Convention
Create focused branches named with descriptive prefixes:
- `feature/<feature-name>` (e.g., `feature/admin-appointment-calendar`)
- `fix/<bug-summary>` (e.g., `fix/rtl-slider-direction`)
- `docs/<doc-name>` (e.g., `docs/payment-gateway-spec`)
- `perf/<optimization>` (e.g., `perf/vazirmatn-subsetting`)

### 2.2 Local Verification Before Committing
Every contribution must pass the full verification matrix locally:

```bash
# 1. Verify TypeScript types
npm run typecheck

# 2. Verify ESLint rules
npm run lint

# 3. Run automated unit & component tests
npm test

# 4. Verify production build output
npm run build
```

---

## 3. Conventional Commit Standards

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) standard:

- `feat:` A new user-facing feature (e.g., `feat: implement live theme preview in admin panel`)
- `fix:` A bug fix (e.g., `fix: resolve static prerender error on admin faq page`)
- `docs:` Documentation changes only (e.g., `docs: add comprehensive runbook and disaster recovery SOP`)
- `style:` Changes that do not affect the meaning of the code (formatting, white-space)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests or correcting existing tests
- `chore:` Maintenance tasks, dependency bumps, or build tool adjustments

---

## 4. Pull Request Checklist

Before submitting a PR for review, verify:
- [ ] Code compiles cleanly with zero TypeScript errors (`npm run typecheck`).
- [ ] Lint passes with zero warnings (`npm run lint`).
- [ ] All Vitest unit tests pass (`npm test`).
- [ ] Page renders properly in RTL mode at `/` and LTR mode at `/en`.
- [ ] Mobile responsive layout tested at 390px viewport.
- [ ] Server actions handle errors gracefully with Persian user-facing error messages.
- [ ] No temporary debugging scripts or `.env` files staged in git.
