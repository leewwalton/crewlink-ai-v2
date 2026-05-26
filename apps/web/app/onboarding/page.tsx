import { Suspense } from "react";
import OnboardingPageClient from "./OnboardingPageClient";

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageClient />
    </Suspense>
  );
}
