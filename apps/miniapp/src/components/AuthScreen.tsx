import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api";
import { useRequestFleetAccess } from "../hooks";
import { Icon } from "./crm";
import { Field, TextInput } from "./ui";

type AuthVariant = "login" | "ownerPending" | "viewerPending" | "suspended";

function requestErrorKey(code: string | undefined): string {
  switch (code) {
    case "owner_not_found":
      return "auth.errors.ownerNotFound";
    case "already_requested":
      return "auth.errors.alreadyRequested";
    case "cannot_request_self":
      return "auth.errors.cannotRequestSelf";
    case "already_viewer":
      return "auth.errors.alreadyViewer";
    default:
      return "common.error";
  }
}

export function AuthScreen(props: {
  variant: AuthVariant;
  telegramUserId?: string;
  fleetOwnerName?: string | null;
  errorMessage?: string;
}) {
  const { t } = useTranslation();
  const requestAccess = useRequestFleetAccess();
  const [ownerTelegramId, setOwnerTelegramId] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  const icon =
    props.variant === "suspended" ? "⛔" : props.variant === "login" ? "🚕" : "⏳";
  const title =
    props.variant === "login"
      ? t("auth.loginTitle")
      : props.variant === "viewerPending"
        ? t("auth.viewerPendingTitle")
        : props.variant === "suspended"
          ? t("pending.title")
          : t("auth.registerTitle");
  const text =
    props.variant === "login"
      ? props.errorMessage || t("auth.loginText")
      : props.variant === "viewerPending"
        ? t("auth.viewerPendingText", { owner: props.fleetOwnerName ?? "—" })
        : props.variant === "suspended"
          ? t("pending.suspended")
          : t("auth.registerText");

  function submitInvestorRequest() {
    const id = ownerTelegramId.trim();
    if (!id) return;
    setRequestError(null);
    requestAccess.mutate(id, {
      onSuccess: () => {
        setRequestSent(true);
        setOwnerTelegramId("");
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : undefined;
        setRequestError(t(requestErrorKey(code)));
      },
    });
  }

  return (
    <div className="center-screen crm-auth-screen">
      <Icon name="taxi" size={40} color="var(--taxi-accent)" />
      <span className="crm-auth-screen__emoji" aria-hidden>
        {icon}
      </span>
      <h2 className="crm-auth-screen__title">{title}</h2>
      <p className="crm-auth-screen__text">{text}</p>
      {props.telegramUserId ? (
        <p className="crm-auth-screen__id">
          {t("pending.yourId")}: <code>{props.telegramUserId}</code>
        </p>
      ) : null}
      {props.variant === "ownerPending" ? (
        <>
          <p className="crm-auth-screen__hint">{t("auth.registerHint")}</p>
          <div className="crm-auth-screen__divider" aria-hidden />
          <h3 className="crm-auth-screen__subtitle">{t("auth.requestInvestorTitle")}</h3>
          <p className="crm-auth-screen__hint">{t("auth.requestInvestorHint")}</p>
          {requestSent ? (
            <p className="crm-auth-screen__success">{t("auth.requestSent")}</p>
          ) : (
            <div className="crm-auth-screen__form">
              <Field label={t("auth.ownerTelegramId")}>
                <TextInput
                  value={ownerTelegramId}
                  onChange={setOwnerTelegramId}
                  placeholder="123456789"
                />
              </Field>
              {requestError ? <p className="crm-form-error">{requestError}</p> : null}
              <button
                type="button"
                className="crm-btn-primary"
                disabled={requestAccess.isPending || !ownerTelegramId.trim()}
                onClick={submitInvestorRequest}
              >
                {t("auth.requestAccess")}
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
