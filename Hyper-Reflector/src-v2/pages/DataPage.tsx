import { useState } from "react";

type DataPage = {
  onSignup?: () => void;
};

export function DataPage({ onSignup }: DataPageProps = {}) {
  return (
    <div className="h-full flex items-center justify-center">Coming Soon</div>
  );
}
