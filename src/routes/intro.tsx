import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { IntroSplash } from "@/components/AuthGate";

export const Route = createFileRoute("/intro")({
  component: IntroPage,
  head: () => ({
    meta: [
      { title: "পরিচিতি — সমিতি" },
      { name: "description", content: "সমিতির পরিচিতি, লক্ষ্য, বাণী ও বর্তমান কমিটি" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">পাওয়া যায়নি</div>,
});

function IntroPage() {
  const navigate = useNavigate();
  return (
    <IntroSplash
      forceShow
      enterLabel="← ড্যাশবোর্ডে ফিরে যান"
      onEnter={() => navigate({ to: "/" })}
    />
  );
}
