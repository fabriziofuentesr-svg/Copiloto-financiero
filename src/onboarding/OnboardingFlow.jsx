import React, { useState } from "react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Welcome } from "./Welcome.jsx";
import { ProductIntroduction } from "./ProductIntroduction.jsx";
import { ProfileSetup } from "./ProfileSetup.jsx";
import { FinancialSetup } from "./FinancialSetup.jsx";
import { GuideCarousel } from "./GuideCarousel.jsx";
import { OnboardingComplete } from "./OnboardingComplete.jsx";

// Orquesta la primera configuración sin duplicar los modelos de perfil,
// cuentas o movimientos que usa el resto de la aplicación.
export function OnboardingFlow() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [step, setStep] = useState(state.profile.name ? "finance" : "welcome");

  function handleProfileComplete(profileData) {
    dispatch({ type: "UPDATE_PROFILE", payload: profileData });
    setStep("finance");
  }

  function finishOnboarding() {
    dispatch({ type: "COMPLETE_ONBOARDING", payload: {} });
  }

  if (step === "welcome") {
    return <Welcome onStart={() => setStep("introduction")} />;
  }

  if (step === "introduction") {
    return <ProductIntroduction onBack={() => setStep("welcome")} onContinue={() => setStep("profile")} />;
  }

  if (step === "profile") {
    return (
      <ProfileSetup
        initialValues={state.profile}
        onBack={() => setStep("introduction")}
        onComplete={handleProfileComplete}
      />
    );
  }

  if (step === "finance") {
    return <FinancialSetup onBack={() => setStep("profile")} onContinue={() => setStep("guide")} />;
  }

  if (step === "complete") {
    return <OnboardingComplete onBack={() => setStep("guide-last")} onFinish={finishOnboarding} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md border border-line rounded p-6 bg-paper">
        <GuideCarousel
          includeIntroduction={false}
          initialStep={step === "guide-last" ? 4 : 0}
          onFinish={() => setStep("complete")}
          onSkip={() => setStep("complete")}
        />
      </div>
    </div>
  );
}

