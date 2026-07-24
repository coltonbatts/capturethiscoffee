import type { Metadata } from "next";
import {
  PublicInfoPage,
  PublicInfoSection,
} from "@/components/public-info-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Capture This Coffee",
  description:
    "How the Capture This Coffee web and iOS printer companion handle production links, crew label data, and Bluetooth printing.",
};

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      title="Privacy policy"
      summary="This policy describes the Capture This Coffee production web app and the Capture This iOS printer companion."
    >
      <p className="text-sm font-bold text-zinc-600">
        Effective date: July 15, 2026
      </p>

      <PublicInfoSection title="What the service handles">
        <p>
          Authorized Capture This operators may enter production details, crew
          names, groups or roles, drink orders, and label status in the hosted
          web app. A production share link contains a secret token that grants
          limited access to one production&apos;s day-of workflow. Anyone who
          receives a share link should treat it as private.
        </p>
        <p>
          The iOS app uses that link to retrieve the production name, printable
          crew names and drink orders, group and order status, rendered label
          images, and whether each label has been printed. It does not receive
          private person notes or dietary notes through the printer queue.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="How the information is used">
        <p>
          Production information is used only to operate the coffee-order and
          label-printing workflow: loading a production queue, rendering a
          label, printing it, and synchronizing successful print status back to
          the hosted service.
        </p>
        <p>
          The iOS app communicates with the Capture This backend over HTTPS and
          with a nearby NIIMBOT M2_H printer over Bluetooth Low Energy. Nearby
          Bluetooth device information is used on the device to connect to the
          printer and is not sent to the Capture This backend.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Storage and retention">
        <p>
          The iOS app stores the active production session in the iOS Keychain
          until the operator changes productions or removes the app. If a
          physical print cannot be synchronized immediately, the app stores a
          small local recovery record until the operator resolves the print
          status. The app does not store the rendered label library as a
          permanent local archive.
        </p>
        <p>
          Production and order records remain in the hosted service for
          operational and production-record purposes until an authorized
          Capture This operator deletes them or a deletion request is handled.
          Share tokens may expire or be revoked without deleting the underlying
          production record.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Service providers">
        <p>
          Capture This uses Supabase for hosted authentication, database, and
          storage services, and Vercel to host and deliver the web app and API.
          These providers process information only as needed to provide their
          infrastructure services to Capture This.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Tracking, advertising, and diagnostics">
        <p>
          The current iOS app does not contain advertising, cross-app tracking,
          third-party marketing analytics, or a crash-reporting SDK. Capture
          This does not sell production or crew information. Standard hosting
          and security logs may record technical request information needed to
          operate and protect the service; production share tokens are not
          intentionally written to application logs.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Access, correction, and deletion">
        <p>
          Crew members and operators may ask about, correct, or request deletion
          of information associated with a production by contacting Capture
          This at{" "}
          <a
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            href="mailto:info@capturethis.com?subject=Capture%20This%20Coffee%20privacy"
          >
            info@capturethis.com
          </a>
          . Include the production name and date, but do not email a production
          share token.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Policy changes and contact">
        <p>
          Material changes will be posted on this page with an updated effective
          date. Privacy questions may be sent to{" "}
          <a
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            href="mailto:info@capturethis.com?subject=Capture%20This%20Coffee%20privacy"
          >
            info@capturethis.com
          </a>
          .
        </p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
