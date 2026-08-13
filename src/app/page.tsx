import { redirect } from "next/navigation";

/** The queue board is what an organizer opens the app for. */
export default function Home() {
  redirect("/queue");
}
