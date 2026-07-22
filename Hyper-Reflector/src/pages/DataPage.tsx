import { useTranslation } from "react-i18next";

type DataPageProps = {
  onSignup?: () => void;
};

export function DataPage({ onSignup }: DataPageProps = {}) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex items-center justify-center">{t("common.comingSoon")}</div>
  );
}
