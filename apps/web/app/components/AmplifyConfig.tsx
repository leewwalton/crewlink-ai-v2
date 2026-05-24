"use client";

import { useEffect } from "react";
import { runAmplifyConfig } from "../config/amplify";

export function AmplifyConfig() {
  useEffect(() => {
    runAmplifyConfig();
  }, []);

  return null;
}
