import React, { useState } from "react";
import { useFinanceState, useFinanceDispatch } from "../context/FinanceContext.jsx";
import { Welcome } from "./Welcome.jsx";
import { ProfileSetup } from "./ProfileSetup.jsx";
import { GuideCarousel } from "./GuideCarousel.jsx";

// Orquesta BIENVENIDA -> CONFIGURACIÓN INICIAL -> GUÍA -> APLICACIÓN.
// Si el navegador se recarga después de completar el perfil pero antes de
// terminar la guía, arrancamos directo en la guía en vez de repetir todo.
export function OnboardingFlow() {
  const state = useFinanceState();
  const dispatch = useFinanceDispatch();
  const [step, setStep] = useState(state.profile.name ? "guide" : "welcome");

  function handleProfileComplete(profileData) {
    dispatch({ type: "UPDATE_PROFILE", payload: profileData });
    setStep("guide");
  }

  function finishOnboarding() {
    dispatch({ type: "COMPLETE_ONBOARDING", payload: {} });
  }

  if (step === "welcome") {
    return <Welcome onStart={() => setStep("setup")} />;
  }

  if (step === "setup") {
    return <ProfileSetup initialValues={state.profile} onComplete={handleProfileComplete} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md border border-line rounded p-6 bg-paper">
        <GuideCarousel onFinish={finishOnboarding} onSkip={finishOnboarding} />
      </div>
    </div>
  );
}
