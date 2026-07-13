import "@/components/brain/brain.css";

export default function BrainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div data-section="brain">{children}</div>;
}
