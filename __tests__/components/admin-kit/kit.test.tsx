import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/admin/leads',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

import { PageHeader } from '@/components/admin/kit/page-header';
import { DataTable } from '@/components/admin/kit/data-table';
import { StatCard } from '@/components/admin/kit/stat-card';
import { BulkBar } from '@/components/admin/kit/bulk-bar';
import { Pager, pagerRange } from '@/components/admin/kit/pager';
import { ExpiryBadge } from '@/components/admin/kit/expiry-badge';
import { stageBadge, ticketBadge, taskBadge, lifecycleBadge, churnBadge } from '@/components/admin/kit/status-badge';
import { FilterBar } from '@/components/admin/kit/filter-bar';
import { JalaliDateField } from '@/components/admin/kit/jalali-date-field';
import { EmptyState } from '@/components/admin/kit/empty-state';
import { AdminTabs } from '@/components/admin/kit/admin-tabs';

type Row = { id: string; name: string };
const rows: Row[] = [
  { id: 'a', name: 'سارا' },
  { id: 'b', name: 'علی' },
];
const columns = [{ key: 'name', header: 'نام', cell: (r: Row) => r.name, sortable: true }];

describe('PageHeader', () => {
  it('always starts the trail with پیشخوان and marks the last crumb current', () => {
    render(<PageHeader title="مشتریان" breadcrumbs={[{ label: 'مشتریان', href: '/admin/customers' }, { label: 'سارا احمدی' }]} />);
    const trail = screen.getByTestId('breadcrumbs');
    expect(trail.textContent).toContain('پیشخوان');
    expect(trail.querySelector('[aria-current="page"]')?.textContent).toBe('سارا احمدی');
  });
});

describe('DataTable', () => {
  it('renders rows, selection and sort callbacks', () => {
    const onSel = vi.fn();
    const onSort = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} selectable selected={[]} onSelectedChange={onSel} sort={null} onSortChange={onSort} />);
    expect(screen.getAllByTestId('data-row')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('انتخاب همه ردیف‌ها'));
    expect(onSel).toHaveBeenCalledWith(['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: /نام/ }));
    expect(onSort).toHaveBeenCalledWith({ key: 'name', dir: 'asc' });
  });
  it('shows the empty node and the loading skeleton', () => {
    const { rerender } = render(<DataTable columns={columns} rows={[]} rowKey={(r: Row) => r.id} empty={<EmptyState title="موردی نیست" />} />);
    expect(screen.getByTestId('empty-state').textContent).toContain('موردی نیست');
    rerender(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} loading />);
    expect(screen.getByTestId('data-table-loading')).toBeTruthy();
  });
  it('renders one card per row below md when mobileCard is given', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} mobileCard={(r) => <b>{r.name}</b>} />);
    expect(screen.getAllByTestId('data-row-card')).toHaveLength(2);
  });
});

describe('StatCard', () => {
  it('exposes stat-card-<key> and links when href is given', () => {
    render(<StatCard statKey="expired" label="منقضی" value="۳" href="/admin/inventory" />);
    const el = screen.getByTestId('stat-card-expired');
    expect(el.tagName).toBe('A');
    expect(el.getAttribute('href')).toBe('/admin/inventory');
  });
});

describe('BulkBar', () => {
  it('renders nothing at zero and wires actions', () => {
    const { rerender } = render(<BulkBar count={0} actions={[]} onClear={() => {}} />);
    expect(screen.queryByTestId('bulk-bar')).toBeNull();
    const click = vi.fn();
    const clear = vi.fn();
    rerender(<BulkBar count={2} actions={[{ label: 'برچسب', onClick: click }]} onClear={clear} />);
    fireEvent.click(screen.getByText('برچسب'));
    fireEvent.click(screen.getByText('لغو انتخاب'));
    expect(click).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
  });
});

describe('Pager', () => {
  it('computes the visible range', () => {
    expect(pagerRange(1, 25, 3420)).toEqual({ from: 1, to: 25, pageCount: 137 });
    expect(pagerRange(1, 25, 0)).toEqual({ from: 0, to: 0, pageCount: 1 });
    expect(pagerRange(2, 25, 30)).toEqual({ from: 26, to: 30, pageCount: 2 });
  });
  it('disables prev on the first page and calls onPage', () => {
    const onPage = vi.fn();
    render(<Pager page={1} pageSize={25} total={60} onPage={onPage} />);
    expect((screen.getByTestId('pager-prev') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('pager-next'));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

describe('badges', () => {
  it('ExpiryBadge always carries text for the state', () => {
    render(<ExpiryBadge state="critical" daysLeft={12} />);
    expect(screen.getByTestId('expiry-badge').textContent).toContain('انقضای بحرانی');
    expect(screen.getByTestId('expiry-badge').textContent).toContain('مانده');
  });
  it('presets print Persian labels', () => {
    render(
      <div>
        {stageBadge('APPOINTMENT_BOOKED')}
        {ticketBadge('PENDING')}
        {taskBadge('DONE')}
        {lifecycleBadge('AT_RISK')}
        {churnBadge('HIGH')}
      </div>,
    );
    for (const t of ['نوبت ثبت شد', 'منتظر پاسخ مشتری', 'انجام‌شده', 'در معرض ریزش', 'ریسک بالا']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByTestId('churn-badge')).toBeTruthy();
  });
});

describe('FilterBar', () => {
  it('debounces search and resets', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(<FilterBar search={{ value: '', placeholder: 'جست‌وجو' }} onChange={onChange} onReset={onReset} debounceMs={100} />);
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'سارا' } });
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(120);
    expect(onChange).toHaveBeenCalledWith({ q: 'سارا' });
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(onReset).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('JalaliDateField', () => {
  it('emits an ISO date for a valid Jalali input and null for invalid', () => {
    const onChange = vi.fn();
    render(<JalaliDateField value={null} onChange={onChange} label="تاریخ" />);
    const input = screen.getByLabelText('تاریخ');
    fireEvent.change(input, { target: { value: '۱۴۰۶/۰۸/۲۰' } });
    expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00/);
    fireEvent.change(input, { target: { value: '1406/13/40' } });
    expect(onChange.mock.calls.at(-1)?.[0]).toBeNull();
    expect(screen.getByText(/معتبر نیست/)).toBeTruthy();
  });
});

describe('AdminTabs', () => {
  it('marks the active tab', () => {
    render(<AdminTabs items={[{ id: 'a', label: 'الف' }, { id: 'b', label: 'ب', count: 3 }]} value="b" testIdPrefix="report-tab" />);
    expect(screen.getByTestId('report-tab-b').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('report-tab-a').getAttribute('aria-current')).toBeNull();
  });
});
