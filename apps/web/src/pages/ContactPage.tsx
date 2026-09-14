import type { ContactRequest } from '@hiddengem/shared';
import { CircleCheck, LoaderCircle } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Seo } from '@/components/Seo';
import { PageHeader } from '@/components/sections/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { trackEvent } from '@/lib/analytics';
import { ApiError, submitContact } from '@/lib/api';

// Shown in the admin notification subject as [topic], so inbox rules can route them.
const TOPICS = ['General enquiry', 'Partnership', 'Press', 'Support', 'Other'];

type Status = { state: 'idle' | 'sending' | 'sent' } | { state: 'error'; details: string[] };

export default function ContactPage() {
  const { getToken } = useRecaptcha();
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) ?? '').trim();

    setStatus({ state: 'sending' });
    try {
      const payload: ContactRequest = {
        name: field('name'),
        email: field('email'),
        organization: field('organization') || undefined,
        topic: field('topic') || undefined,
        message: field('message'),
        source: 'contact-page',
        recaptchaToken: await getToken('contact'),
      };
      await submitContact(payload);
      form.reset();
      setStatus({ state: 'sent' });
      // GA4's recommended lead event. The topic is a fixed option, not personal data.
      trackEvent('generate_lead', { form: 'contact', topic: payload.topic ?? 'none' });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'We could not verify your submission. Please refresh and try again.';
      setStatus({ state: 'error', details: error instanceof ApiError ? error.details : [] });
      toast.error(message);
    }
  }

  return (
    <>
      <Seo
        title="Contact"
        description="Placeholder: get in touch with the Hidden Gem NC team."
        path="/contact"
      />
      <PageHeader eyebrow="Contact" title="Get in touch">
        Placeholder: tell visitors what to expect — who reads messages and how fast you reply.
      </PageHeader>

      <section className="mx-auto max-w-2xl px-6 py-16">
        {status.state === 'sent' ? (
          <div role="status" className="rounded-xl border bg-card p-8 text-center shadow-xs">
            <CircleCheck className="mx-auto size-10 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold">Thanks — message sent</h2>
            <p className="mt-2 text-muted-foreground">We&apos;ll get back to you shortly.</p>
            <Button variant="outline" className="mt-6" onClick={() => setStatus({ state: 'idle' })}>
              Send another message
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-xl border bg-card p-6 shadow-xs md:p-8"
            noValidate={false}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input id="contact-name" name="name" autoComplete="name" required maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-organization">
                  Organization <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="contact-organization"
                  name="organization"
                  autoComplete="organization"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-topic">Topic</Label>
                <select
                  id="contact-topic"
                  name="topic"
                  defaultValue={TOPICS[0]}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                >
                  {TOPICS.map((topic) => (
                    <option key={topic}>{topic}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                name="message"
                required
                minLength={10}
                maxLength={5000}
                rows={6}
              />
            </div>

            {status.state === 'error' && status.details.length > 0 && (
              <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
                {status.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={status.state === 'sending'}
            >
              {status.state === 'sending' ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" /> Sending…
                </>
              ) : (
                'Send message'
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              This form is protected by reCAPTCHA; the Google{' '}
              <a className="underline" href="https://policies.google.com/privacy">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a className="underline" href="https://policies.google.com/terms">
                Terms of Service
              </a>{' '}
              apply.
            </p>
          </form>
        )}
      </section>
    </>
  );
}
