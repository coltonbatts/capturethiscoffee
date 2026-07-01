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
  cardClass,
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
      <AppShell title="Client not found" requireAuth>
        <EmptyState
          title="Client not found"
          action={
            <Link href="/clients" className={secondaryButtonClass}>
              <ArrowLeft size={18} aria-hidden="true" />
              Back
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={client?.name || "Client"}
      requireAuth
      actions={
        <Link href="/clients" className={secondaryButtonClass} aria-label="Back to clients">
          <ArrowLeft size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Clients</span>
        </Link>
      }
    >
      {client?.notes ? (
        <p className="mb-4 text-sm leading-6 text-zinc-600">{client.notes}</p>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={addContact} className="mb-4 grid gap-3">
        <Panel className="grid gap-3 p-4">
          <Field label="Search">
            <input
              className={inputClass}
              value={personQuery}
              onChange={(event) => setPersonQuery(event.target.value)}
              placeholder="Name, role, department"
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
          <Field label="Notes">
            <input
              className={inputClass}
              value={relationshipNotes}
              onChange={(event) => setRelationshipNotes(event.target.value)}
              placeholder="Optional"
            />
          </Field>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={!personId || saving}
          >
            <Plus size={18} aria-hidden="true" />
            {saving ? "Saving…" : "Link contact"}
          </button>
        </Panel>
      </form>

      <div className="grid gap-3">
        {!data ? (
          [0, 1, 2].map((item) => (
            <Panel key={item} className="h-24 animate-pulse bg-zinc-100 p-4" />
          ))
        ) : !linked.length ? (
          <EmptyState title="No contacts" description="Link people from your roster." />
        ) : (
          linked.map(({ link, person }) => (
            <article key={link.id} className={`${cardClass} flex gap-3`}>
              <Avatar person={person} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">{person.name}</h2>
                <p className="truncate text-sm text-zinc-600">
                  {[person.role, person.department].filter(Boolean).join(" · ") ||
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
