import { Seo } from '@/components/Seo';
import { PageHeader } from '@/components/sections/PageHeader';

export default function PrivacyPage() {
  return (
    <>
      <Seo
        title="Privacy Policy"
        description="How Hidden Gem NC handles personal information."
        path="/privacy"
      />
      <PageHeader title="Privacy Policy" />
      <section className="mx-auto max-w-3xl space-y-4 px-6 py-16 text-muted-foreground">
        <p className="rounded-md border border-dashed p-4 text-sm">
          <strong className="text-foreground">Placeholder.</strong> Replace with the privacy policy
          approved by counsel before launch. It should cover the contact form (name, email and
          message are stored for 90 days and emailed to the team), reCAPTCHA and Google Analytics
          (Google), online booking (Calendly collects the booking details and sets its own cookies),
          and the links to Instagram, Facebook and TikTok.
        </p>
      </section>
    </>
  );
}
