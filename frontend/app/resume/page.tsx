import { redirect } from "next/navigation";

// The portfolio landing already renders the resume — keep one canonical spot.
export default function ResumeRedirect() {
  redirect("/#resume");
}
