import { describe, it, expect } from 'vitest';
import { NAV_GROUPS, navFor, isNavActive, navSlug, navTitleFor, QUICK_CREATE } from '@/lib/admin/nav';
import { WIDGETS, canSeeWidget, visibleWidgets } from '@/components/admin/dashboard/visibility';
import { phoneNeedle, textVariants } from '@/lib/admin/search-text';

const all = NAV_GROUPS.flatMap((g) => g.items);

describe('admin nav', () => {
  it('has 25 items in 6 groups (root plus 5 labelled)', () => {
    expect(all).toHaveLength(25);
    expect(NAV_GROUPS.filter((g) => g.label)).toHaveLength(5);
  });
  it('gives every item a unique route, slug and icon', () => {
    expect(new Set(all.map((i) => i.href)).size).toBe(all.length);
    expect(new Set(all.map((i) => navSlug(i.href))).size).toBe(all.length);
    expect(new Set(all.map((i) => i.icon)).size).toBe(all.length);
  });
  it('filters by role', () => {
    const hrefs = (r: Parameters<typeof navFor>[0]) => navFor(r).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs('VIEWER')).toContain('/admin/leads');
    expect(hrefs('VIEWER')).not.toContain('/admin/settings');
    expect(hrefs('AUTHOR')).toContain('/admin/posts');
    expect(hrefs('AUTHOR')).not.toContain('/admin/products');
    expect(hrefs('ADMIN')).toContain('/admin/audit');
    expect(hrefs('SUPER_ADMIN')).toHaveLength(all.length);
  });
  it('keeps merged sub-routes highlighted', () => {
    const home = all.find((i) => i.href === '/admin/homepage')!;
    expect(isNavActive(home, '/admin/menus')).toBe(true);
    expect(isNavActive(home, '/admin/menus/5')).toBe(true);
    expect(isNavActive(all.find((i) => i.href === '/admin')!, '/admin/orders')).toBe(false);
    expect(navTitleFor('/admin/staff')).toBe('خدمات و کادر درمان');
  });
  it('quick-create targets exist', () => {
    expect(QUICK_CREATE.map((q) => q.id)).toEqual(['customer', 'lead', 'task', 'order', 'batch']);
  });
});

describe('dashboard visibility', () => {
  it('shows owners everything and viewers only read widgets', () => {
    expect(visibleWidgets('ADMIN')).toHaveLength(Object.keys(WIDGETS).length);
    expect(canSeeWidget('VIEWER', 'outbox')).toBe(false);
    expect(canSeeWidget('VIEWER', 'tasks')).toBe(false);
    expect(canSeeWidget('VIEWER', 'sales')).toBe(true);
    expect(canSeeWidget('EDITOR', 'sales')).toBe(false);
    expect(canSeeWidget('EDITOR', 'tasks')).toBe(true);
    expect(visibleWidgets('AUTHOR')).toEqual([]);
  });
});

describe('search helpers', () => {
  it('normalises phones', () => {
    expect(phoneNeedle('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567');
    expect(phoneNeedle('+989121234567')).toBe('09121234567');
    expect(phoneNeedle('0912')).toBe('0912');
    expect(phoneNeedle('سارا')).toBeNull();
  });
  it('searches both forms of ی and ک', () => {
    const v = textVariants('کیان');
    expect(v).toContain('کیان');
    expect(v).toContain('كيان');
  });
});
