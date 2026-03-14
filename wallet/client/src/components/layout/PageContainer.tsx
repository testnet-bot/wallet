import React from "react";
import "../../styles/globals.css";

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="page-container page-enter"
      style={{ maxWidth: '100%', padding: 'var(--space-md)' }}
    >
      {children}
    </main>
  );
}
