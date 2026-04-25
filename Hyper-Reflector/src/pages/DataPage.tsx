import { useState } from "react";

type DataPageProps = {
  onSignup?: () => void;
};

export function DataPage({ onSignup }: DataPageProps = {}) {
  return (
    <div className="h-full flex items-center justify-center">Coming Soon</div>
  );
}
