import { useTranslation } from "react-i18next";

type TournamentPageProps = {
  onSignup?: () => void;
};

export function TournamentPage({ onSignup }: TournamentPageProps = {}) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex items-center justify-center">{t("common.comingSoon")}</div>
  );
}
