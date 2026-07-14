import "@/components/brain/brain.css";
import "@/components/coding/coding.css";

export default function CodingLayout({ children }: { children: React.ReactNode }) {
  return <div data-section="brain">{children}</div>;
}
