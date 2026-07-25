import type { Metadata } from "next";
import {
  PublicInfoPage,
  PublicInfoSection,
} from "@/components/public-info-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Capture This Coffee",
  description:
    "How the Capture This Coffee web and iOS app handle accounts, production data, offline board caching, and Bluetooth printing.",
};

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      title="Privacy policy"
      summary="This policy describes the Capture This Coffee iOS app, its frozen web fallback, and the shared production service."
    >
      <p className="text-sm font-bold text-zinc-600">
        Effective date: July 25, 2026
      </p>

      <PublicInfoSection title="What the service handles">
        <p>
          Invited Capture This operators sign in to access production details,
          crew names, groups or roles, usual drinks, day-specific drink orders,
          and label status. Every invited account in the current workspace has
          the same operator access. Public account signup is disabled.
        </p>
        <p>
          The current iOS app requests the existing days and the selected
          day&apos;s production, client name, on-set roster, crew names, roles,
          departments, usual drinks, drink orders, and printed status directly
          from the shared service. It does not request private person notes or
          dietary notes in the current day board.
        </p>
        <p>
          A fallback production share link contains a secret token that grants
          limited access to one production&apos;s day-of workflow. Anyone who
          receives a share link should treat it as private.
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
          The iOS app communicates directly with Supabase over HTTPS for
          authentication and shared production data. The frozen web app and
          token-scoped fallback APIs are hosted on Vercel. The app communicates
          with a nearby NIIMBOT M2_H printer over Bluetooth Low Energy. Nearby
          Bluetooth device information is used on the device to connect to the
          printer and is not sent to Supabase or Vercel.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Storage and retention">
        <p>
          The iOS app stores the Supabase sign-in session and any Legacy-link
          production token in the iOS Keychain. To keep an accepted day usable
          without a signal, it stores the selected-day pointer and a limited
          number of recent production boards in app-sandboxed local
          preferences, separated by account and production. Those cached boards
          can include production details, crew names, roles, usual drinks,
          day-specific drink orders, and printed status.
        </p>
        <p>
          Signing out removes the active board from the app interface and
          prevents another account from reading it, but account-scoped cached
          boards may remain on the device until they are replaced, cleared by a
          later app version, or the app is removed. If a physical print cannot
          be synchronized immediately, the app stores a small local recovery
          record until the operator resolves the print status. The app does not
          keep rendered label images as a permanent local archive.
        </p>
        <p>
          Production, account, and order records remain in the hosted service
          for operational and production-record purposes until an authorized
          Capture This operator deletes them or a deletion request is handled.
          Share tokens may expire or be revoked without deleting the
          underlying production record.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Service providers">
        <p>
          Capture This uses Supabase for hosted authentication, database, and
          storage services, and Vercel to host and deliver the frozen web app
          and fallback API.
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
