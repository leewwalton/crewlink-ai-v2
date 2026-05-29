"use client";

import { useLayoutEffect } from "react";
import { runAmplifyConfig } from "../config/amplify";

export function AmplifyConfig() {
  useLayoutEffect(() => {
    runAmplifyConfig();
  }, []);

  return null;
}
