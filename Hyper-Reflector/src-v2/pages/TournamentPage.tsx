import { useState } from "react";

type TournamentPage = {
  onSignup?: () => void;
};

export function TournamentPage({ onSignup }: TournamentPageProps = {}) {
  return (
    <div className="h-full flex items-center justify-center">Coming Soon</div>
  );
}
