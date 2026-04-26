"use client";

import { ConversationProvider } from "@elevenlabs/react";
import { NarratorProvider } from "./narrator-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConversationProvider>
      <NarratorProvider>{children}</NarratorProvider>
    </ConversationProvider>
  );
}
