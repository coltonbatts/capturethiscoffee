"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  assignLabelTemplateToProductionAction,
  createLabelTemplateDraftAction,
  duplicateLabelTemplateDraftAction,
  publishLabelTemplateVersionAction,
  setDefaultLabelTemplateVersionAction,
  updateLabelTemplateDraftAction,
} from "@/app/operator-actions";
import { AppShell } from "@/components/app-shell";
import { ScreenLabel } from "@/components/coffee-label-renderer";
import {
  Field,
  alertErrorClass,
  alertStatusClass,
  inputClass,
  pageHeaderClass,
  pageIntroClass,
  pageTitleClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import type { CoffeeLabel } from "@/lib/label-copy";
import { unwrapOperatorAction } from "@/lib/operator-inputs";
import {
  parseLabelTemplateDefinitionJson,
  type LabelTemplateDefinition,
} from "@/lib/label-template-schema";
import type { Production } from "@/lib/types";
import type {
  LabelTemplateVersionDto,
  LabelTemplateWorkspaceDto,
} from "@/server/operator/label-templates";

const sampleLabel: CoffeeLabel = {
  id: "template-proof",
  personName: "Cameron Ellington-Smythe",
  drink: "Iced oat latte, half sweet",
  group: "Camera",
  productionClient: "Morning Unit / Studio",
  notesStatus: "",
  orderId: "#B13",
  title: "Cameron Ellington-Smythe",
  bodyLines: ["Iced oat latte, half sweet"],
  footerStart: "",
  footerEnd: "",
  lines: [],
};

export function LabelTemplateWorkspaceClient({
  initialWorkspace,
  productions,
  initialError,
}: {
  initialWorkspace: LabelTemplateWorkspaceDto | null;
  productions: Production[];
  initialError: string;
}) {
  const workspace = initialWorkspace;
  const defaultSelection =
    workspace?.versions.find(
      (version) => version.id === workspace.defaultVersionId,
    )?.id ||
    workspace?.versions[0]?.id ||
    "";
  const [selectedVersionId, setSelectedVersionId] = useState(defaultSelection);
  const selectedVersion =
    workspace?.versions.find((version) => version.id === selectedVersionId) ||
    workspace?.versions[0];

  return (
    <AppShell
      title="Label templates"
      breadcrumbs={[
        { label: "Labels", href: "/labels" },
        { label: "Templates" },
      ]}
      requireAuth
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-1 sm:px-0">
        <header className={pageHeaderClass}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                Template control / Build 13
              </p>
              <h1 className={pageTitleClass}>Label templates</h1>
              <p className={pageIntroClass}>
                Draft and validate declarative 591×354 layouts. Publishing makes
                a version immutable; active days keep their exact assigned
                version.
              </p>
            </div>
            <Link className={secondaryButtonClass} href="/labels">
              Back to print queue
            </Link>
          </div>
        </header>

        {initialError ? (
          <p className={alertErrorClass} role="alert">
            {initialError}
          </p>
        ) : null}

        {workspace && selectedVersion ? (
          <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="border border-black/20 bg-[#fffdf8]">
              <div className="border-b border-black/20 bg-black px-4 py-3 text-white">
                <h2 className="font-mono text-xs font-bold uppercase tracking-[0.14em]">
                  Version ledger
                </h2>
              </div>
              <div className="grid max-h-[70dvh] overflow-y-auto">
                {workspace.versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setSelectedVersionId(version.id)}
                    aria-pressed={selectedVersion.id === version.id}
                    className={`grid min-h-16 gap-1 border-b border-black/15 px-4 py-3 text-left last:border-b-0 ${
                      selectedVersion.id === version.id
                        ? "bg-[#f6c945] text-black"
                        : "bg-transparent hover:bg-black/[0.04]"
                    }`}
                  >
                    <span className="font-semibold">
                      {version.templateName} / v{version.version}
                    </span>
                    <span className="flex flex-wrap gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                      <span>{version.status}</span>
                      {workspace.defaultVersionId === version.id ? (
                        <span>Default</span>
                      ) : null}
                      {productions.some(
                        (production) =>
                          production.status === "planning" &&
                          production.label_template_version_id === version.id,
                      ) ? (
                        <span>Assigned</span>
                      ) : null}
                      {productions.some(
                        (production) =>
                          production.status !== "planning" &&
                          production.label_template_version_id === version.id,
                      ) ? (
                        <span>Locked</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <TemplateEditor
              key={selectedVersion.id}
              version={selectedVersion}
              workspace={workspace}
              productions={productions}
            />
          </div>
        ) : initialError ? null : (
          <p className={alertErrorClass} role="alert">
            No label template versions are available.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function TemplateEditor({
  version,
  workspace,
  productions,
}: {
  version: LabelTemplateVersionDto;
  workspace: LabelTemplateWorkspaceDto;
  productions: Production[];
}) {
  const router = useRouter();
  const identity = workspace.templates.find(
    (template) => template.id === version.templateId,
  );
  const [displayName, setDisplayName] = useState(
    identity?.displayName || version.templateName,
  );
  const [description, setDescription] = useState(identity?.description || "");
  const [changelog, setChangelog] = useState(version.changelog);
  const [definitionText, setDefinitionText] = useState(() =>
    JSON.stringify(version.definition, null, 2),
  );
  const [proof, setProof] = useState<LabelTemplateDefinition>(
    version.definition,
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState(`${version.templateName} Variant`);
  const [assignmentDayId, setAssignmentDayId] = useState(
    productions.find((production) => production.status === "planning")?.id || "",
  );
  const publishedVersions = useMemo(
    () => workspace.versions.filter((candidate) => candidate.status === "published"),
    [workspace.versions],
  );
  const planningProductions = productions.filter(
    (production) => production.status === "planning",
  );

  function validateDraft() {
    const parsed = parseLabelTemplateDefinitionJson(definitionText);
    if (!parsed.ok) {
      setProof(version.definition);
      setStatus("");
      setError(parsed.errors.slice(0, 5).join(" "));
      return null;
    }
    setProof(parsed.value);
    setError("");
    setStatus(
      `Valid schema 1 · ${parsed.value.pixelWidth}×${parsed.value.pixelHeight} · ${parsed.value.elements.length} elements.`,
    );
    return parsed.value;
  }

  async function run(
    operation: () => Promise<unknown>,
    successMessage: string,
  ) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await operation();
      setStatus(successMessage);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    const definition = validateDraft();
    if (!definition) return;
    await run(
      async () => {
        unwrapOperatorAction(
          await updateLabelTemplateDraftAction(version.id, {
            displayName,
            description,
            changelog,
            definition,
          }),
        );
      },
      "Draft saved and revalidated.",
    );
  }

  async function publishDraft() {
    const definition = validateDraft();
    if (!definition) return;
    if (
      !window.confirm(
        `Publish ${displayName} v${version.version}? Published versions are immutable.`,
      )
    ) {
      return;
    }
    await run(
      async () => {
        unwrapOperatorAction(
          await updateLabelTemplateDraftAction(version.id, {
            displayName,
            description,
            changelog,
            definition,
          }),
        );
        unwrapOperatorAction(
          await publishLabelTemplateVersionAction(version.id),
        );
      },
      `Published immutable v${version.version}.`,
    );
  }

  async function setAsDefault() {
    if (
      !window.confirm(
        `Make ${version.templateName} v${version.version} the default for future days? Existing days keep their current snapshot.`,
      )
    ) {
      return;
    }
    await run(
      async () => {
        unwrapOperatorAction(
          await setDefaultLabelTemplateVersionAction(version.id),
        );
      },
      `New Planning days will snapshot ${version.templateName} v${version.version}.`,
    );
  }

  return (
    <main className="grid min-w-0 gap-5">
      {error ? (
        <p className={alertErrorClass} role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className={alertStatusClass} role="status" aria-live="polite">
          {status}
        </p>
      ) : null}

      <section className="grid gap-5 border border-black/20 bg-[#fffdf8] p-5 md:grid-cols-[minmax(0,1fr)_minmax(17rem,0.9fr)]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/20 pb-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                {version.templateName} / v{version.version}
              </h2>
              <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                {version.status} · App schema {version.definition.schemaVersion} compatible ·{" "}
                {version.definitionChecksum.slice(0, 12)}
              </p>
            </div>
            {version.status === "published" ? (
              <span className="border border-black bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase">
                Immutable
              </span>
            ) : (
              <span className="border border-black bg-[#f6c945] px-2 py-1 font-mono text-[10px] font-bold uppercase">
                Editable draft
              </span>
            )}
          </div>

          <Field label="Display name">
            <input
              className={inputClass}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={version.status === "published"}
            />
          </Field>
          <Field label="Description">
            <input
              className={inputClass}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={version.status === "published"}
            />
          </Field>
          <Field label="Version note">
            <input
              className={inputClass}
              value={changelog}
              onChange={(event) => setChangelog(event.target.value)}
              disabled={version.status === "published"}
            />
          </Field>
        </div>

        <div className="grid content-start gap-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            Long-name proof / production renderer
          </p>
          <div className="grid aspect-[5/3] place-items-center overflow-hidden border border-black/20 bg-[#e8e3d8] p-3">
            <ScreenLabel label={sampleLabel} design={proof} />
          </div>
          <p className="text-xs font-medium leading-relaxed text-zinc-600">
            Preview and exported PNGs share one bounded interpreter. Definitions
            cannot load URLs, scripts, fonts, plugins, or executable content.
          </p>
        </div>
      </section>

      {version.status === "draft" ? (
        <section className="grid gap-4 border border-black/20 bg-[#fffdf8] p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.025em]">
              Declarative definition
            </h2>
            <p className="mt-1 text-sm font-medium text-zinc-600">
              JSON is validated in the browser, again in the authenticated
              server action, and again by the database.
            </p>
          </div>
          <label className="grid gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.1em]">
              591×354 schema JSON
            </span>
            <textarea
              className={`${inputClass} min-h-96 resize-y font-mono text-xs leading-relaxed`}
              spellCheck={false}
              value={definitionText}
              onChange={(event) => setDefinitionText(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={validateDraft}
              disabled={busy}
            >
              Validate & proof
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void saveDraft()}
              disabled={busy}
            >
              Save draft
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => void publishDraft()}
              disabled={busy}
            >
              Publish immutable v{version.version}
            </button>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 border border-black/20 bg-[#fffdf8] p-5">
          <h2 className="text-lg font-semibold tracking-[-0.025em]">
            Published controls
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={busy}
              onClick={() =>
                void run(
                  async () => {
                    unwrapOperatorAction(
                      await duplicateLabelTemplateDraftAction(version.id),
                    );
                  },
                  `Created editable draft v${version.version + 1}.`,
                )
              }
            >
              Duplicate to draft
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={busy || workspace.defaultVersionId === version.id}
              onClick={() => void setAsDefault()}
            >
              {workspace.defaultVersionId === version.id
                ? "Current default"
                : "Set as new-day default"}
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-4 border border-black/20 bg-[#fffdf8] p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.025em]">
            Planning assignment
          </h2>
          <p className="mt-1 text-sm font-medium text-zinc-600">
            Assignment freezes when a day becomes Active. Completed days cannot
            change.
          </p>
        </div>
        {planningProductions.length > 0 && publishedVersions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Planning day">
              <select
                className={inputClass}
                value={assignmentDayId}
                onChange={(event) => setAssignmentDayId(event.target.value)}
              >
                {planningProductions.map((production) => (
                  <option key={production.id} value={production.id}>
                    {production.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={
                  busy ||
                  version.status !== "published" ||
                  !assignmentDayId
                }
                onClick={() =>
                  void run(
                    async () => {
                      unwrapOperatorAction(
                        await assignLabelTemplateToProductionAction(
                          assignmentDayId,
                          version.id,
                        ),
                      );
                    },
                    `Assigned exact ${version.templateName} v${version.version}.`,
                  )
                }
              >
                Assign selected version
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-zinc-600">
            No Planning production is available for assignment.
          </p>
        )}
      </section>

      <section className="grid gap-4 border border-black/20 bg-black p-5 text-white">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#f6c945]">
            New identity
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">
            Start a separate template from this proof
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Slug">
            <input
              className={inputClass}
              placeholder="studio-variant"
              value={newSlug}
              onChange={(event) => setNewSlug(event.target.value)}
            />
          </Field>
          <Field label="Display name">
            <input
              className={inputClass}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </Field>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 w-fit items-center justify-center border border-white bg-white px-4 text-sm font-bold text-black hover:bg-[#f6c945]"
          disabled={busy}
          onClick={() =>
            void run(
              async () => {
                const parsed = parseLabelTemplateDefinitionJson(definitionText);
                if (!parsed.ok) throw new Error(parsed.errors[0]);
                unwrapOperatorAction(
                  await createLabelTemplateDraftAction({
                    slug: newSlug,
                    displayName: newName,
                    description,
                    changelog: `Started from ${version.templateName} v${version.version}.`,
                    definition: parsed.value,
                  }),
                );
              },
              `Created ${newName} as an editable v1 draft.`,
            )
          }
        >
          Create new draft
        </button>
      </section>
    </main>
  );
}
