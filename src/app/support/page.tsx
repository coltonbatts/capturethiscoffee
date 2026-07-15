import type { Metadata } from "next";
import {
  PublicInfoPage,
  PublicInfoSection,
} from "@/components/public-info-page";

export const metadata: Metadata = {
  title: "Support | Capture This Coffee",
  description:
    "Setup, printing, synchronization recovery, and contact help for the Capture This iOS printer companion.",
};

export default function SupportPage() {
  return (
    <PublicInfoPage
      title="Support"
      summary="Help for Capture This crews using the iOS printer companion with a NIIMBOT M2_H."
    >
      <PublicInfoSection title="What you need">
        <ul className="list-disc space-y-1 pl-5">
          <li>An iPhone with the current Capture This app.</li>
          <li>A production share URL provided by a Capture This operator.</li>
          <li>A NIIMBOT M2_H with the expected label stock loaded.</li>
          <li>Bluetooth and internet access.</li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title="Link and print">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Force-quit the official NIIMBOT app.</li>
          <li>Paste the full HTTPS production share URL.</li>
          <li>Wake the M2_H and tap Connect printer.</li>
          <li>Print one test label before starting a batch.</li>
          <li>Confirm the printed status appears in the web app.</li>
        </ol>
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
            For queue errors, confirm the production is active and the share
            link has not expired or been revoked.
          </li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title="Contact">
        <p>
          Email{" "}
          <a
            className="font-black underline underline-offset-4"
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
