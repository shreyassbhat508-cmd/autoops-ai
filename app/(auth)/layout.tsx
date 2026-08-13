export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="font-display text-lg font-semibold tracking-tight">
            AutoOps <span className="text-accent">AI</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
