import {
  FlaskConical,
  Home,
  MessageCircle,
  Settings,
  SquareLibrary,
  Trophy,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import hrLogo from "../assets/logo.svg";

export type Page =
  | "lobby"
  | "home"
  | "profiles"
  | "settings"
  | "lab"
  | "data"
  | "pools";

type NavRailProps = {
  currentPage: Page;
  onNavigate: (page: Page) => void;
};

export function NavRail({ currentPage, onNavigate }: NavRailProps) {
  const { t } = useTranslation();
  const NavBtn = ({
    page,
    icon,
    label,
    isDisabled,
  }: {
    page: Page;
    icon: React.ReactNode;
    label: string;
    isDisabled?: boolean;
  }) => (
    <button
      disabled={isDisabled}
      onClick={() => onNavigate(page)}
      title={label}
      aria-label={label}
      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
        currentPage === page
          ? "bg-[var(--v2-accent)] text-[var(--v2-accent-fg)]"
          : "text-[var(--v2-muted)] hover:text-[var(--v2-text)] hover:bg-[var(--v2-hover)]"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <nav
      className="w-16 flex flex-col items-center py-4 gap-6 border-r shrink-0"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      <div className="h-10 w-10 flex items-center justify-center">
        <img src={hrLogo} alt="HR" className="h-8 w-8" />
      </div>
      <span className="text-[10px]" style={{ color: "var(--v2-muted)" }}>
        {__APP_VERSION__}
      </span>
      <div className="flex flex-col items-center gap-4 flex-1">
        <NavBtn page="home" icon={<Home size={18} />} label={t("nav.home")} />
        <NavBtn page="lobby" icon={<MessageCircle size={18} />} label={t("nav.lobby")} />
        <NavBtn page="pools" icon={<Trophy size={18} />} label={t("nav.pools")} />
        <NavBtn page="profiles" icon={<Users size={18} />} label={t("nav.profiles")} />
        <NavBtn page="data" icon={<SquareLibrary size={18} />} label={t("nav.data")} />
        <NavBtn page="lab" icon={<FlaskConical size={18} />} label={t("nav.lab")} />
      </div>

      <div className="flex flex-col items-center gap-4">
        <NavBtn
          page="settings"
          icon={<Settings size={18} />}
          label={t("nav.settings")}
        />
      </div>
    </nav>
  );
}
