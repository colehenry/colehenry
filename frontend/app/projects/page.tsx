import { redirect } from "next/navigation";

// The portfolio landing already renders projects - keep one canonical spot.
export default function ProjectsRedirect() {
  redirect("/#projects");
}
