import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { ApiError } from "../api";
import { useRegisterAsOwner, useRequestFleetAccess, useSetLocale } from "../hooks";
import { Icon } from "./crm";
import { Field, TextInput } from "./ui";
import { LOCALE_OPTIONS, normalizeLocale, type AppLocale } from "../locales";

type AuthVariant = "login" | "chooseRole" | "ownerPending" | "viewerPending" | "suspended";
type AccountRole = "owner" | "investor";

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
    case "already_owner":
      return "auth.errors.alreadyOwner";
    case "already_investor":
      return "auth.errors.alreadyInvestor";
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
  const registerOwner = useRegisterAsOwner();
  const setLocale = useSetLocale();
  const [selectedRole, setSelectedRole] = useState<AccountRole | null>(null);
  const [ownerTelegramId, setOwnerTelegramId] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);

  const icon =
    props.variant === "suspended" ? "⛔" : props.variant === "login" ? "🚕" : "⏳";
  const title =
    props.variant === "login"
      ? t("auth.loginTitle")
      : props.variant === "chooseRole"
        ? t("auth.chooseRoleTitle")
        : props.variant === "viewerPending"
          ? t("auth.viewerPendingTitle")
          : props.variant === "suspended"
            ? t("pending.title")
            : t("auth.registerTitle");
  const text =
    props.variant === "login"
      ? props.errorMessage || t("auth.loginText")
      : props.variant === "chooseRole"
        ? t("auth.chooseRoleText")
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
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : undefined;
        setRequestError(t(requestErrorKey(code)));
      },
    });
  }

  function submitOwnerRegistration() {
    setRequestError(null);
    registerOwner.mutate(undefined, {
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : undefined;
        setRequestError(t(requestErrorKey(code)));
      },
    });
  }

  function changeLanguage(value: AppLocale) {
    void i18n.changeLanguage(value);
    localStorage.setItem("locale", value);
    setLocale.mutate(value);
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

      {props.variant === "chooseRole" ? (
        <>
          <div className="crm-auth-screen__form">
            <Field label={t("settings.language")}>
              <label className="crm-language crm-auth-language">
                <select
                  className="crm-language__select"
                  value={normalizeLocale(i18n.language)}
                  onChange={(e) => changeLanguage(e.target.value as AppLocale)}
                >
                  {LOCALE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="crm-language__label">
                  {LOCALE_OPTIONS.find((o) => o.value === normalizeLocale(i18n.language))?.label ??
                    "English"}
                </span>
              </label>
            </Field>
          </div>

          <div className="crm-auth-role-grid">
            <button
              type="button"
              className={`crm-auth-role-btn${selectedRole === "owner" ? " crm-auth-role-btn--active" : ""}`}
              onClick={() => {
                setSelectedRole("owner");
                setRequestError(null);
              }}
            >
              <Icon name="car-01" size={22} color="var(--taxi-accent)" />
              <span className="crm-auth-role-btn__title">{t("auth.roleOwnerTitle")}</span>
              <span className="crm-auth-role-btn__hint">{t("auth.roleOwnerHint")}</span>
            </button>
            <button
              type="button"
              className={`crm-auth-role-btn${selectedRole === "investor" ? " crm-auth-role-btn--active" : ""}`}
              onClick={() => {
                setSelectedRole("investor");
                setRequestError(null);
              }}
            >
              <Icon name="user" size={22} color="var(--taxi-accent)" />
              <span className="crm-auth-role-btn__title">{t("auth.roleInvestorTitle")}</span>
              <span className="crm-auth-role-btn__hint">{t("auth.roleInvestorHint")}</span>
            </button>
          </div>

          {selectedRole === "owner" ? (
            <div className="crm-auth-screen__form">
              <p className="crm-auth-screen__hint">{t("auth.roleOwnerRequestHint")}</p>
              {requestError ? <p className="crm-form-error">{requestError}</p> : null}
              <button
                type="button"
                className="crm-btn-primary"
                disabled={registerOwner.isPending}
                onClick={submitOwnerRegistration}
              >
                {t("auth.requestBusinessAccess")}
              </button>
            </div>
          ) : null}

          {selectedRole === "investor" ? (
            <div className="crm-auth-screen__form">
              <p className="crm-auth-screen__hint">{t("auth.requestInvestorHint")}</p>
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
          ) : null}
        </>
      ) : null}

      {props.variant === "ownerPending" ? (
        <>
          <p className="crm-auth-screen__hint">{t("auth.registerHint")}</p>
          <div className="crm-auth-screen__divider" aria-hidden />
          <h3 className="crm-auth-screen__subtitle">{t("auth.switchToInvestorTitle")}</h3>
          <p className="crm-auth-screen__hint">{t("auth.requestInvestorHint")}</p>
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
              className="crm-btn-outline"
              disabled={requestAccess.isPending || !ownerTelegramId.trim()}
              onClick={submitInvestorRequest}
            >
              {t("auth.requestAccess")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
