'use client';

import { useRef, useState, useTransition } from 'react';
import { changePasswordAction } from '@/app/actions/customer-auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { useHydrated } from '@/components/account/use-hydrated';

/**
 * Set a password (SMS-only accounts) or change it. Changing it signs every other
 * device out; this one stays signed in.
 */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const notReady = !useHydrated();

  return (
    <form
      ref={formRef}
      method="post"
      className="max-w-lg space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const res = await changePasswordAction(fd);
          if (res.error) return setError(res.error);
          formRef.current?.reset();
          toast.success(hasPassword ? 'رمز عبور تغییر کرد' : 'رمز عبور ذخیره شد', 'از این پس می‌توانید با شماره موبایل و رمز عبور وارد شوید.');
        });
      }}
    >
      {error && <Alert tone="error">{error}</Alert>}
      {hasPassword && (
        <Field label="رمز عبور فعلی" required>
          <Input name="currentPassword" type="password" autoComplete="current-password" dir="auto" required />
        </Field>
      )}
      <Field label={hasPassword ? 'رمز عبور جدید' : 'رمز عبور'} hint="حداقل ۸ نویسه و نه فقط عدد." required>
        <Input name="newPassword" type="password" autoComplete="new-password" dir="auto" required />
      </Field>
      <Field label="تکرار رمز عبور" required>
        <Input name="confirmPassword" type="password" autoComplete="new-password" dir="auto" required />
      </Field>
      <Button type="submit" variant="gold" loading={pending} loadingText="در حال ذخیره…" disabled={notReady}>
        {hasPassword ? 'تغییر رمز عبور' : 'ذخیره رمز عبور'}
      </Button>
      {hasPassword && <p className="field-hint">با تغییر رمز عبور، از سایر دستگاه‌ها خارج می‌شوید.</p>}
    </form>
  );
}
