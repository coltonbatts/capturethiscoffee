import type { Metadata } from "next";
import {
  PublicInfoPage,
  PublicInfoSection,
} from "@/components/public-info-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Capture This",
  description:
    "How the Capture This web and iOS app handle accounts, production data, private photos and notes, offline caching, and Bluetooth printing.",
};

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      title="Privacy policy"
      summary="This policy describes the Capture This iOS app, its authenticated web tools, and the shared production service."
    >
      <p className="text-sm font-bold text-zinc-600">
        Effective date: July 30, 2026
      </p>

      <PublicInfoSection title="What the service handles">
        <p>
          Invited Capture This operators sign in to access production details,
          production and client details; crew names, roles, departments,
          companies, private photos, usual drinks, dietary and general notes;
          rosters and day-specific drink orders; label templates; printed
          status; and closeout status. Every invited account in the current
          workspace has the same operator access. Public account signup is
          disabled.
        </p>
        <p>
          The current iOS app requests the existing days and the selected
          day&apos;s production, client, on-set roster, crew names, roles,
          departments, private photo references, usual drinks, drink orders,
          printed status, and assigned label-template definition directly from
          the shared service. Its online preparation tools can also view or
          edit company, private photo, dietary-note, and general-note fields.
          An operator can collect or edit day-specific drink details, mark
          no-drink, optionally update a usual drink, prepare people and rosters,
          and complete an eligible Active day. Those changes are sent to the
          shared service under the signed-in account.
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
          label-printing workflow: loading a day, collecting or editing its
          orders, preparing people and rosters, synchronizing a published label
          template, rendering and printing one label at a time, resolving
          conflicts, replaying offline work, building a shareable day summary,
          completing an eligible day, and synchronizing successful print status
          back to the hosted service.
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
          can include production details, crew names, roles, private photo
          references, usual drinks, day-specific drink orders, printed status,
          and the validated published template assigned to that day.
        </p>
        <p>
          Signing out removes the active board from the app interface and
          prevents another account from reading it, but account-scoped cached
          boards may remain on the device until they are replaced, cleared by a
          later app version, or the app is removed. If a physical print cannot
          be synchronized immediately, the app stores a small local recovery
          record until the operator resolves the print status. The app does not
          keep rendered label images as a permanent local archive. Nearby
          Bluetooth device details, label previews, and printer packets are
          processed locally and are not uploaded to Supabase or Vercel.
        </p>
        <p>
          Production, account, and order records remain in the hosted service
          for operational and production-record purposes until an authorized
          Capture This operator deletes eligible records or a deletion request
          is handled. Complete production history and immutable published
          template versions may be retained when needed for operational
          integrity. Share tokens may expire or be revoked without deleting the
          underlying production record.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Service providers">
        <p>
          Capture This uses Supabase for hosted authentication, database, and
          storage services, and Vercel to host and deliver the authenticated web
          app and fallback API. These providers process information as part of
          delivering and securing those hosted services.
        </p>
      </PublicInfoSection>

      <PublicInfoSection title="Tracking, advertising, and diagnostics">
        <p>
          The current iOS app does not contain advertising, cross-app tracking,
          third-party marketing analytics, or a crash-reporting SDK. Capture
          This does not sell production or crew information. Standard hosting
          and security logs may retain an IP address, request time, user agent,
          request path, response status, and authenticated account identifier as
          needed to operate and protect the service. Production share tokens
          are not intentionally written to application logs.
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
        <p>
          The iOS app has no account-creation or public-signup flow. Accounts
          are provisioned by an owner outside the app. An invited operator can
          use the same contact to request that an account and associated
          information be reviewed or deleted.
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
