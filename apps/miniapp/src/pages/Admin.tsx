import { List, Section, Cell, Button, Spinner, Badge } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { OwnerStatus } from "@taxi/shared";
import { useOwners, useActivateOwner, useSuspendOwner } from "../hooks";
import { formatDate } from "../components/ui";

export function AdminPage() {
  const { t } = useTranslation();
  const owners = useOwners(true);
  const activate = useActivateOwner();
  const suspend = useSuspendOwner();

  return (
    <List>
      <Section header={t("admin.title")}>
        {owners.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {owners.data?.length === 0 && <Cell>{t("common.empty")}</Cell>}
        {owners.data?.map((o) => (
          <Cell
            key={o.id}
            subtitle={`@${o.username ?? "—"} • ID ${o.telegramUserId}`}
            description={`${t("admin.cars")}: ${o.cars} • ${t("admin.drivers")}: ${o.drivers} • ${t("admin.createdAt")}: ${formatDate(o.createdAt)}`}
            after={<Badge type="number" mode={badgeMode(o.status)}>{t(`admin.${o.status}`)}</Badge>}
          >
            <div>
              <div style={{ marginBottom: 6 }}>{o.name ?? "—"}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {o.status !== OwnerStatus.ACTIVE && (
                  <Button
                    size="s"
                    onClick={() => activate.mutate(o.id)}
                    loading={activate.isPending && activate.variables === o.id}
                  >
                    {t("admin.activate")}
                  </Button>
                )}
                {o.status !== OwnerStatus.SUSPENDED && (
                  <Button
                    size="s"
                    mode="outline"
                    onClick={() => suspend.mutate(o.id)}
                    loading={suspend.isPending && suspend.variables === o.id}
                  >
                    {t("admin.suspend")}
                  </Button>
                )}
              </div>
            </div>
          </Cell>
        ))}
      </Section>
    </List>
  );
}

function badgeMode(status: OwnerStatus): "primary" | "critical" | "secondary" {
  if (status === OwnerStatus.ACTIVE) return "primary";
  if (status === OwnerStatus.SUSPENDED) return "critical";
  return "secondary";
}
