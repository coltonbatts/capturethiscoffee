"use client";

import { ArrowLeft, Plus, UserMinus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Avatar,
  EmptyState,
  Field,
  Panel,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  linkPersonToClient,
  listClientLinkedPeople,
  loadCoffeeData,
  unlinkPersonFromClient,
} from "@/lib/data";
import type { CoffeeData } from "@/lib/types";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CoffeeData | null>(null);
  const [personQuery, setPersonQuery] = useState("");
  const [personId, setPersonId] = useState("");
  const [relationshipNotes, setRelationshipNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadCoffeeData()
      .then((next) => {
        if (mounted) setData(next);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const client = data?.clients.find((item) => item.id === params.id);

  const linked = useMemo(
    () => (data && client ? listClientLinkedPeople(data, client.id) : []),
    [data, client],
  );

  const linkedIds = useMemo(
    () => new Set(linked.map((item) => item.person.id)),
    [linked],
  );

  const availablePeople = useMemo(() => {
    const needle = personQuery.trim().toLowerCase();
    return (data?.people || [])
      .filter((person) => person.active && !linkedIds.has(person.id))
      .filter((person) => {
        if (!needle) return true;
        return [person.name, person.role, person.department, person.company]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, linkedIds, personQuery]);

  async function addContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !client || !personId || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await linkPersonToClient(
        data,
        client.id,
        personId,
        relationshipNotes,
      );
      setData(next);
      setPersonId("");
      setRelationshipNotes("");
      setPersonQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link contact.");
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(personIdToRemove: string) {
    if (!data || !client || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await unlinkPersonFromClient(
        data,
        client.id,
        personIdToRemove,
      );
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove contact.");
    } finally {
      setSaving(false);
    }
  }

  if (data && !client) {
    return (
      <AppShell title="Client not found" eyebrow="Database">
        <EmptyState
          title="Client not found"
          description="This client may have been removed or the link is invalid."
          action={
            <Link href="/clients" className={secondaryButtonClass}>
              <ArrowLeft size={18} aria-hidden="true" />
              Back to clients
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={client?.name || "Client"}
      eyebrow="Client contacts"
      actions={
        <Link href="/clients" className={secondaryButtonClass}>
          <ArrowLeft size={18} aria-hidden="true" />
          Clients
        </Link>
      }
    >
      <Panel className="mb-4 p-4">
        <p className="production-kicker text-zinc-500">Saved contacts</p>
        <h1 className="text-2xl font-black uppercase tracking-wider">
          {client?.name || "Loading"}
        </h1>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          People linked here are added to the roster when you start a production
          for this client, plus up to four crew members.
        </p>
        {client?.notes ? (
          <p className="mt-3 text-sm leading-6 text-zinc-700">{client.notes}</p>
        ) : null}
      </Panel>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={addContact}
        className="mb-4 grid gap-3 border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
      >
        <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
          Link existing person
        </p>
        <Field label="Search people">
          <input
            className={inputClass}
            value={personQuery}
            onChange={(event) => setPersonQuery(event.target.value)}
            placeholder="Filter by name, role, department"
          />
        </Field>
        <Field label="Person">
          <select
            className={inputClass}
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            required
          >
            <option value="">Select a person</option>
            {availablePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.role ? ` — ${person.role}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Relationship notes (optional)">
          <input
            className={inputClass}
            value={relationshipNotes}
            onChange={(event) => setRelationshipNotes(event.target.value)}
            placeholder="Primary approval contact, agency lead"
          />
        </Field>
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={!personId || saving}
        >
          <Plus size={18} aria-hidden="true" />
          {saving ? "Saving" : "Link contact"}
        </button>
      </form>

      <div className="grid gap-3">
        {!data ? (
          [0, 1, 2].map((item) => (
            <Panel key={item} className="h-24 animate-pulse bg-white/70 p-4" />
          ))
        ) : !linked.length ? (
          <EmptyState
            title="No contacts linked"
            description="Link people from your roster so they appear on new productions for this client."
          />
        ) : (
          linked.map(({ link, person }) => (
            <article
              key={link.id}
              className="flex gap-3 border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
            >
              <Avatar person={person} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black uppercase tracking-wide">
                  {person.name}
                </h2>
                <p className="truncate text-sm font-semibold text-zinc-600">
                  {[person.role, person.department].filter(Boolean).join(" / ") ||
                    person.type.replace("_", " ")}
                </p>
                {link.relationship_notes ? (
                  <p className="mt-2 text-sm leading-5 text-zinc-700">
                    {link.relationship_notes}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={dangerButtonClass}
                disabled={saving}
                onClick={() => removeContact(person.id)}
              >
                <UserMinus size={18} aria-hidden="true" />
                Remove
              </button>
            </article>
          ))
        )}
      </div>
    </AppShell>
  );
}
