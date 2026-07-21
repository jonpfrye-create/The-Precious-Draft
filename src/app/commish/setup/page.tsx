import SetupForm from "./SetupForm";

export default function SetupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <h1 className="text-3xl font-semibold">Set up the Main draft</h1>
      <SetupForm />
    </div>
  );
}
