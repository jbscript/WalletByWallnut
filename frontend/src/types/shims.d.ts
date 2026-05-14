// Treat shadcn UI components (which live as .jsx without types) as any
declare module "@/components/ui/*";

// Misc env types
declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_BACKEND_URL: string;
  }
}
