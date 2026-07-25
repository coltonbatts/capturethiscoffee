import type { Metadata } from "next";
import {
  PublicInfoPage,
  PublicInfoSection,
} from "@/components/public-info-page";

export const metadata: Metadata = {
  title: "Support | Capture This Coffee",
  description:
    "Sign-in, day selection, offline printing, synchronization recovery, and NIIMBOT M2_H help for Capture This.",
};

export default function SupportPage() {
  return (
    <PublicInfoPage
      title="Support"
      summary="Help for Capture This crews using the signed-in iOS app with a NIIMBOT M2_H."
    >
      <PublicInfoSection title="What you need">
        <ul className="list-disc space-y-1 pl-5">
          <li>An iPhone with the current Capture This app.</li>
          <li>An owner-provisioned Capture This email/password.</li>
          <li>An existing Active production day.</li>
          <li>A NIIMBOT M2_H with the expected label stock loaded.</li>
          <li>
            Bluetooth access. Internet is required to sign in and load a new
            day; a previously cached day can remain printable without a signal.
          </li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title="Sign in and print">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open Capture This, sign in, and choose the Active day.</li>
          <li>Force-quit the official NIIMBOT app.</li>
          <li>Wake the M2_H and tap Connect printer.</li>
          <li>Print one test label before starting a batch.</li>
          <li>Confirm the printed status synchronizes in Capture This.</li>
        </ol>
        <p>
          Use <strong>Advanced · Legacy link</strong> only when the coordinator
          asks you to test the fallback production URL.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Avoid the wrong printer">
        <p>
          If more than one NIIMBOT is nearby, power off the printers you do not
          intend to use. This release is limited to the intended NIIMBOT M2_H
          workflow and will stop instead of choosing among multiple nearby
          NIIMBOT devices. Complete the documented physical gate for the exact
          printer, firmware, and stock before production use.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="If a print does not sync">
        <p>
          Do not print the label again. Use <strong>Sync only</strong> to retry
          the web update without producing another physical label. If the app
          says <strong>Check printer</strong>, inspect the printer first, then
          choose either <strong>Label printed — sync only</strong> or{" "}
          <strong>Nothing printed — retry</strong>.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Connection problems">
        <ul className="list-disc space-y-1 pl-5">
          <li>Confirm Bluetooth is enabled for Capture This in iOS Settings.</li>
          <li>Force-quit the official NIIMBOT app on nearby phones and tablets.</li>
          <li>Power-cycle the printer, then reconnect in Capture This.</li>
          <li>Do not update printer firmware as a troubleshooting step.</li>
          <li>
            For queue errors, confirm the selected production is Active and
            refresh when a connection is available.
          </li>
          <li>
            For Legacy-link errors, confirm the private share link has not
            expired or been revoked.
          </li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title="Contact">
        <p>
          Email{" "}
          <a
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            href="mailto:info@capturethis.com?subject=Capture%20This%20Coffee%20support"
          >
            info@capturethis.com
          </a>
          . Include the app version, iPhone and iOS version, printer model and
          firmware, label size, and the exact step that failed. Do not send a
          production share token, password, or private crew data.
        </p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
