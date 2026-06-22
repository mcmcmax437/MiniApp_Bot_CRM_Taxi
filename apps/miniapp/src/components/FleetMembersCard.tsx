import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFleetMembers, useSaveFleetMember, useUpdateFleetMember, useDeleteFleetMember } from "../hooks";
import { IconActionButton } from "./crm";
import { Field, TextInput } from "./ui";
import type { FleetMember } from "../types";

/**
 * Investor access form + member list. The page-level title and subtitle
 * live in `Admin.tsx` next to the "Owners" title, so this component just
 * renders the form and the list. The previous version wrapped everything
 * in a `SectionCard` with its own `team.title` heading, which is what
 * made the investor section look like a different kind of block from the
 * "Owners" list above it.
 */
export function FleetMembersCard() {
  const { t } = useTranslation();
  const members = useFleetMembers();
  const create = useSaveFleetMember();
  const update = useUpdateFleetMember();
  const del = useDeleteFleetMember();
  const [telegramUserId, setTelegramUserId] = useState("");
  const [name, setName] = useState("");

  function submitInvite() {
    const id = telegramUserId.trim();
    if (!id) return;
    create.mutate(
      { telegramUserId: id, name: name.trim() || undefined },
      {
        onSuccess: () => {
          setTelegramUserId("");
          setName("");
        },
      },
    );
  }

  return (
    <div className="crm-team-invite-card">
      <p className="crm-form-hint">{t("team.hint")}</p>
      <div className="crm-team-invite">
        <Field label={t("team.telegramId")}>
          <TextInput value={telegramUserId} onChange={setTelegramUserId} placeholder="123456789" />
        </Field>
        <Field label={t("team.nameOptional")}>
          <TextInput value={name} onChange={setName} />
        </Field>
        <button
          type="button"
          className="crm-btn-primary"
          disabled={create.isPending || !telegramUserId.trim()}
          onClick={submitInvite}
        >
          {t("team.invite")}
        </button>
      </div>
      {members.isLoading ? (
        <p className="crm-form-hint">{t("common.loading")}</p>
      ) : members.data && members.data.length > 0 ? (
        <ul className="crm-team-list">
          {members.data.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              onActivate={() => update.mutate({ id: m.id, status: "ACTIVE" })}
              onSuspend={() => update.mutate({ id: m.id, status: "SUSPENDED" })}
              onRemove={() => del.mutate(m.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="crm-form-hint">{t("team.empty")}</p>
      )}
    </div>
  );
}

function MemberRow(props: {
  member: FleetMember;
  onActivate: () => void;
  onSuspend: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const m = props.member;
  return (
    <li className="crm-team-list__item">
      <div>
        <strong>{m.name || m.username || m.telegramUserId}</strong>
        <div className="crm-form-hint">
          ID {m.telegramUserId} · {t(`team.status.${m.status}`)}
        </div>
      </div>
      <div className="crm-team-list__actions">
        {m.status !== "ACTIVE" ? (
          <button type="button" className="crm-link-btn" onClick={props.onActivate}>
            {t("team.activate")}
          </button>
        ) : (
          <button type="button" className="crm-link-btn" onClick={props.onSuspend}>
            {t("team.suspend")}
          </button>
        )}
        <IconActionButton icon="delete-02" label={t("common.delete")} onClick={props.onRemove} />
      </div>
    </li>
  );
}
